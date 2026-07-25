class AddClassroomFeedbackAndProjectLocking < ActiveRecord::Migration[8.1]
  def change
    add_column :projects, :lock_version, :integer, null: false, default: 0

    create_table :project_comments do |t|
      t.references :project, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.text :body, null: false
      t.string :file_path
      t.integer :line_number
      t.datetime :edited_at
      t.datetime :resolved_at
      t.references :resolved_by, foreign_key: { to_table: :users }

      t.timestamps
    end
    add_index :project_comments, [ :project_id, :created_at ]
    add_index :project_comments, [ :project_id, :resolved_at ]

    create_table :project_comment_reads do |t|
      t.references :project, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.datetime :read_at, null: false

      t.timestamps
    end
    add_index :project_comment_reads, [ :project_id, :user_id ], unique: true
  end
end
