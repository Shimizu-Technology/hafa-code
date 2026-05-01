class CreateProjectShares < ActiveRecord::Migration[8.1]
  def change
    create_table :project_shares do |t|
      t.string :token, null: false
      t.string :title, null: false
      t.string :kind, null: false
      t.jsonb :snapshot, null: false, default: {}
      t.datetime :expires_at

      t.timestamps
    end

    add_index :project_shares, :token, unique: true
    add_index :project_shares, :created_at
  end
end
