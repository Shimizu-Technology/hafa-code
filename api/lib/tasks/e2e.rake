namespace :e2e do
  desc "Reset the isolated browser-test database and load deterministic classroom fixtures"
  task reset: :environment do
    database_name = ActiveRecord::Base.connection_db_config.database.to_s
    unless Rails.env.test? && database_name.end_with?("_e2e")
      abort "Refusing to reset #{database_name.inspect}; E2E fixtures require RAILS_ENV=test and an _e2e database."
    end

    load Rails.root.join("db/e2e_seeds.rb")
  end
end
