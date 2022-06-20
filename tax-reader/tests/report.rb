# frozen_string_literal: true


require_relative '../reader'
require 'date'

app_reader = TaxReader::ReportReader.new
app_reader.read_reports(Date.new(2021, 2, 1))
