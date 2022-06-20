# frozen_string_literal: true

class NittyUtility
  class Files
    def self.iterate(folder)
      Dir.children(folder).sort.each do |file|
        next if ['.', '..', '.DS_Store'].include?(file)

        yield(file)
      end
    end
  end
end
