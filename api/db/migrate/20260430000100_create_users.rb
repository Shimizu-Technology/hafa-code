class CreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :clerk_id, null: false
      t.string :email, null: false
      t.string :first_name
      t.string :last_name
      t.integer :role, null: false, default: 0
      t.datetime :last_sign_in_at

      t.timestamps
    end

    add_index :users, :clerk_id, unique: true
    add_index :users, "LOWER(email)", unique: true, name: "index_users_on_lower_email"
  end
end
