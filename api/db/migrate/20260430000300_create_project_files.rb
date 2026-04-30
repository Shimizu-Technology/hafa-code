class CreateProjectFiles < ActiveRecord::Migration[8.1]
  def change
    create_table :project_files do |t|
      t.references :project, null: false, foreign_key: true
      t.string :path, null: false
      t.string :language, null: false
      t.text :content, null: false, default: ""
      t.integer :position, null: false, default: 0

      t.timestamps
    end

    add_index :project_files, [ :project_id, :path ], unique: true
    add_index :project_files, [ :project_id, :position ]
  end
end
