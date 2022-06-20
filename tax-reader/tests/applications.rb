# frozen_string_literal: true

require_relative '../reader'

app_reader = TaxReader::ApplicationReader.new
app_reader.read_taxes
