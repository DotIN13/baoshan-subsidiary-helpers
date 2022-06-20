require_relative 'reader'
require 'yaml'

io = File.open('result.yml', 'w')

app_reader = TaxReader::ApplicationReader.new
rep_reader = TaxReader::ReportReader.new

app_reader.read_taxes
records = app_reader.bonus_tax_records
records.each do |record|
  next unless record[:bonus_month] && record[:tax].positive?

  report_record = rep_reader.tax_query(record)
  warn "No report record available for #{record[:name]}" if report_record.empty?
  record[:report] = report_record
end

io.write app_reader.bonus_tax_records.to_yaml
