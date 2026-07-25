class CreateApiRateLimits < ActiveRecord::Migration[8.1]
  def change
    create_table :api_rate_limits do |t|
      t.string :key, null: false
      t.datetime :window_started_at, null: false
      t.integer :request_count, null: false, default: 0
      t.timestamps
    end

    add_index :api_rate_limits, :key, unique: true
    add_index :api_rate_limits, :window_started_at
  end
end
