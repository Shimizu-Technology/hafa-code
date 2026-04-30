class CreateProjects < ActiveRecord::Migration[8.1]
  def change
    create_table :projects do |t|
      t.references :user, null: false, foreign_key: true
      t.string :title, null: false
      t.string :kind, null: false
      t.string :visibility, null: false, default: "private"
      t.references :forked_from, foreign_key: { to_table: :projects }

      t.timestamps
    end

    add_index :projects, [ :user_id, :updated_at ]
    add_index :projects, :visibility
  end
end
