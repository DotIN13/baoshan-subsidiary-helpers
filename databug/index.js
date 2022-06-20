import fetch from 'node-fetch';
import parser from 'node-html-parser';
// Download modules
import http from 'http';
import * as fs from 'fs';
import * as path from 'path';
const __dirname = path.resolve();

const COOKIES = 'PASTE COOKIES HERE';

const DICT = {
  'XLZS': '学历证书',
  'LDHT': '劳动合同',
  'PRS': '聘任书',
  'JNPXZS': '技能培训证书',
  'HTWJ': '红头文件',
  'SNDNS': '纳税记录'
};

const timeout = async (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Fetch an array of companies
const listCompanies = () => {
  console.log('Fetching company list...');
  return fetch('http://rjjl.sheitc.sh.gov.cn:6888/jxwadmin/personnelReward/selectAuditList.do', {
    'headers': {
      'accept': 'application/json, text/javascript, */*; q=0.01',
      'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'proxy-connection': 'keep-alive',
      'x-requested-with': 'XMLHttpRequest',
      'cookie': COOKIES
    },
    'referrer': 'http://rjjl.sheitc.sh.gov.cn:6888/jxwadmin/personnelReward/zoneTrial.do?privilegeCode=undefined',
    'referrerPolicy': 'strict-origin-when-cross-origin',
    'body': 'data=%7B%22_search%22%3Afalse%2C%22nd%22%3A1626076014262%2C%22rows%22%3A20%2C%22page%22%3A1%2C%22sidx%22%3A%22%22%2C%22sord%22%3A%22desc%22%2C%22searchType%22%3A%22%22%2C%22applyType%22%3A%221%22%2C%22isFast%22%3Afalse%2C%22q%22%3A%22%22%2C%22o%22%3A%22%22%2C%22w%22%3A%22%22%2C%22s%22%3A%22%22%2C%22e%22%3A%22%22%2C%22m%22%3A%22%22%2C%22n%22%3A%22%22%7D',
    'method': 'POST',
    'mode': 'cors'
  })
    .then(res => res.json())
    .then(json => {
      console.log(`${json.records} companies fetched.`);
      return json.rows;
    })
    .catch(err => console.log(err));
};

// Fetch the detail of an company with the list of personnels
const companyDetail = (id) => {
  return fetch('http://rjjl.sheitc.sh.gov.cn:6888/jxwadmin/personnelRewardAudit/auditPage.do?&applyType=1&id=' + id, {
    'headers': {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      'upgrade-insecure-requests': '1',
      'cookie': COOKIES
    },
    'referrer': 'http://rjjl.sheitc.sh.gov.cn:6888/jxwadmin/personnelReward/zoneTrial.do?privilegeCode=undefined',
    'referrerPolicy': 'strict-origin-when-cross-origin',
    'body': null,
    'method': 'GET',
    'mode': 'cors'
  })
    .then(res => res.text())
    .then(text => {
      return parser.parse(text);
    })
    .catch(err => console.log(err));
};

// Create arrays of personnel objects
const listPersonnels = async (com) => {
  console.log(`Fetching personnels for company ${com.companyName}...`);
  const doc = await companyDetail(com.id);
  const personnelTrs = doc.querySelectorAll('#personInformation>.ApplyTable .trTd');
  // populate @personnels with object data: name & id
  console.log(`Personnels fetched for company ${com.companyName}.`);
  return personnelTrs.map(tr => buildPersonnel(tr));
};

// Build personnel object based on detched data
const buildPersonnel = (tr) => {
  const inputs = tr.querySelectorAll('input');
  return {
    name: inputs[1].getAttribute('value'),
    id: inputs[2].getAttribute('value')
  };
};

// Fetch file list for a personnel
const listFiles = (person) => {
  return fetch('http://rjjl.sheitc.sh.gov.cn:6888/jxwadmin/personnelReward/personnelReward/attachmentsLook/attachmentDetail.do', {
    'headers': {
      'accept': 'application/json, text/javascript, */*; q=0.01',
      'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'proxy-connection': 'keep-alive',
      'x-requested-with': 'XMLHttpRequest',
      'cookie': COOKIES
    },
    'referrer': 'http://rjjl.sheitc.sh.gov.cn:6888/jxwadmin/personnelReward/personnelReward/attachmentsLook.do?year=2021',
    'referrerPolicy': 'strict-origin-when-cross-origin',
    'body': `data=${JSON.stringify({'idCard': person.id, 'year':'2021'})}`,
    'method': 'POST',
    'mode': 'cors'
  })
    .then(res => res.json())
    // Append person to file object
    .then(json => json.attachmentHandleResults)
    .catch(err => console.log(err));
};

// Create company directory if not already exist
const createCompanyDir = (com) => {
  const comIndex = com.index.toLocaleString('en-US', {
    minimumIntegerDigits: 2,
    useGrouping: false
  });
  const comDirName = `${comIndex}-${com.companyName}`;
  const comDir = path.join(__dirname, comDirName);
  fs.access(comDir, fs.constants.F_OK, (err) => {
    if (err) fs.mkdir(comDir, err => {
      if (err) console.log(`Create dir error: ${err}`);
    });
  });
  return Object.assign(com, { dir: comDirName });
};

// Process file list to avoid duplicate filenames
const processFileList = (files) => {
  console.log(`Fetched file list of ${files.length} files, pre-processing...`);
  const counts = {};
  for (const file of files) {
    if (!counts[file.documentType]) {
      counts[file.documentType] = 1;
      file.index = 1;
    } else {
      file.index = ++counts[file.documentType];
    }
  }
  console.log('Pre-process complete.');
};

// Download a single file synchronously
const downloadFile = async (file, person, com) => {
  return new Promise((resolve, reject) => {
    const filename = `${DICT[file.documentType]}-${person.name}-${person.id}-${file.index}.${file.fileType}`;
    const filepath = path.join(__dirname, com.dir, filename);
    console.log(`Downloading ${filename} of ${person.name}`);
    http.get(file.relativePath, res => {
      const stream = fs.createWriteStream(filepath);
      stream.on('open', () => res.pipe(stream));
      stream.on('finish', () => resolve(stream.close()));
    })
      .on('error', err => {
        fs.unlink(filepath);
        console.log(`${filename} download error: ${err.message}`);
        reject(err);
      });
  });
};

// Main download function
const downloadAll = async (com) => {
  const personnels = await listPersonnels(com);
  for (const person of personnels) {
    console.log(`Fetching filelist for personnel ${person.name} of ${com.companyName}`);
    const files = await listFiles(person);
    processFileList(files);
    for (const file of files) {
      await downloadFile(file, person, com);
      await timeout(50);
    }
  }
};

// Main function
(async () => {
  // Fetch company list
  const coms = await listCompanies();
  for (const [index, com] of coms.entries()) {
    com.index = index + 1;
    // Create company directories
    const comWithDir = createCompanyDir(com);
    // Download files for each company
    await downloadAll(comWithDir);
  }
})();

// const test = [{
//   'id': '12F80E2E-2DFF-7D02-D4A1-04845D3A6277',
//   'idcard': '310221197101316811',
//   'documentType': 'XLZS',
//   'sort': '1',
//   'imgPath': '/opt/uploadweb/images/577401829/2018/310221197101316811_XLZS_1.jpg',
//   'createby': null,
//   'createdate': null,
//   'isdelete': '0',
//   'updateby': '2021',
//   'updatedate': null,
//   'relativePath': 'http://rjjl.sheitc.sh.gov.cn:6888/uploadweb/images/577401829/2018/310221197101316811_XLZS_1.jpg',
//   'downloadPath': null,
//   'fileType': 'jpg',
//   'documentSort': null
// }];

// const testPerson = { name: '车宜霖', id: '14010619880831256X', com: 'hahaha'};

// download(test, testPerson);



