class CreateProjectCheckpoints < ActiveRecord::Migration[8.1]
  def change
    create_table :project_checkpoints do |t|
      t.references :project, null: false, foreign_key: true
      t.string :title, null: false
      t.jsonb :snapshot, null: false, default: {}

      t.timestamps
    end

    add_index :project_checkpoints, [ :project_id, :created_at ]
  end
end
