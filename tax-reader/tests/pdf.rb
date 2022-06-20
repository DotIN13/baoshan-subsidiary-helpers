require 'pdf-reader'

reader = PDF::Reader.new("/Users/dotin13/Documents/DotIN13/Govn't/20210709_奖励审核/Helpers/tax-reader/files/extra/10-上海钢联电子商务股份有限公司/纳税记录-伍少波-411282198901294018-1.pdf")

reader.pages.each do |page|
  text = page.text
  text.split("\n").each do |line|
    p line
    p line.end_with? '2021.02'
  end
end
