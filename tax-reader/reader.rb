# frozen_string_literal: true

require 'pdf-reader'
require 'roo'
require 'roo-xls'
require 'date'
require_relative 'lib/files'

class TaxReader
  class Reader
    APPLICATIONS_DIR = 'files/applications'
    REPORTS_DIR = 'files/extra'

    private

    def each_company(dir)
      Dir.children(dir).sort.each do |company|
        next if ['.', '..', '.DS_Store'].include?(company)

        yield(File.join(dir, company))
      end
    end
  end

  # Read excel applications, and return a hash of applicants
  # containing their names and bonus taxes.
  class ApplicationReader < Reader
    attr_reader :bonus_tax_records

    def read_taxes
      @bonus_tax_records = []
      each_company(APPLICATIONS_DIR) do |company|
        tax_xls = Roo::Spreadsheet.open company_file(company, 'tax')
        company_info = {
          company: company.split('-')[-2],
          bonus_month: tax_xls.bonus_month
        }
        bonus_tax_records.push(*extract_bonus(tax_xls, applicants(company)).map { |rec| rec.merge(company_info) })
      end
    end

    private

    # Retrieve applicants from bonus workbook
    def applicants(company)
      bonus_xls = Roo::Spreadsheet.open company_file(company, 'bonus')
      bonus_xls.sheet(0).column(2)[1..-1]
    end

    def extract_bonus(workbook, applicants)
      sheet = workbook.bonus_sheet
      records = []
      # Add all applicants into the result array
      applicants.each { |person| records << { name: person, tax: 0 } }
      # Directly return if no matching tax sheets
      return records unless sheet.any?
      
      tax_col_index = workbook.index_column '应补/退税额', '应补（退）税额'
      name_col_index = workbook.index_column '姓名'
      sheet.each do |row|
        name = row[name_col_index]
        tax = row[tax_col_index].to_f
        next unless applicants.include? name

        # Personnels with the same name not supported
        existing = records.select { |rec| rec[:name] == name }
        raise StandardError if existing[1]

        existing[0][:tax] += tax
      end
      records
    end

    def company_file(company_dir, query)
      Dir.children(company_dir).each do |file|
        return File.join(company_dir, file) if file.include? query
      end
    end
  end

  # Read the official pdf report
  # and filter the line with the corresponding months.
  class ReportReader < Reader
    attr_reader :bonus_tax_records

    # Take in the application data
    def read_reports(month)
      @bonus_tax_records = {}
      each_company(REPORTS_DIR) do |company|
        company_files(company, '纳税记录').each do |tax_report|
          name = tax_report.split('-')[-3]
          records = fetch_bonus_tax(PDF::Reader.new(tax_report), app_item[:bonus_month])
          bonus_tax_records[name] = records
        end
      end
    end

    def tax_query(app_data)
      Dir.children(REPORTS_DIR).each do |company|
        if company.include? app_data[:company]
          Dir.children(File.join(REPORTS_DIR, company)).each do |file|
            if file.start_with?("纳税记录") && file.include?(app_data[:name])
              pdf = PDF::Reader.new(File.join(REPORTS_DIR, company, file))
              return read_from_pdf(pdf, app_data[:bonus_month]) 
            end
          end
        end
      end
      nil
    end

    private

    def read_from_pdf(report_pdf, month)
      time = month.strftime('%Y.%m')
      tax_match = []
      report_pdf.pages.each do |page|
        text = page.text
        tax_match += text.split("\n").filter do |line|
          line.include?("#{time} ") || line.end_with?(time.to_s) || line.include?(" #{month.strftime('%Y%m')} ")
        end
      end
      tax_match
    end

    def company_files(company_dir, query)
      Dir.children(company_dir).map do |file|
        File.join(company_dir, file) if file.include? query
      end.reject(&:nil?)
    end
  end
end

class Roo::Base
  attr_reader :bonus_page_array

  def bonus_sheet
    return bonus_page_array if bonus_page_array

    sheets.reverse.each do |sheet_name|
      page = sheet sheet_name
      return (@bonus_page_array = page.to_matrix.to_a) if bonus_sheet?(page)
    end
    warn "Bonus sheet not found for #{@filename}"
    @bonus_page_array = []
  end

  def index_column(*keywords)
    bonus_sheet.each do |row|
      col_index ||= keywords.map { |keyword| row.index keyword }.reject(&:nil?)[0]
      return col_index if col_index
    end
    warn "#{col_index.join(', ')} column not found for #{@filename}"
    false
  end

  def bonus_sheet?(page)
    page.column('G').include? '全年一次性奖金收入'
  end

  def bonus_month
    bonus_sheet.each do |row|
      row_text = row.join
      next unless row_text.include?('税款所属期')

      month_match = row_text.match(/(\d{4})年(\d+)月(\d+)日/)
      month_match ||= row_text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
      return Date.parse(month_match[1..3].join('-'))
    end
  end
end
