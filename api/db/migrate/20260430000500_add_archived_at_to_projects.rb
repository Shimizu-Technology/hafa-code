class AddArchivedAtToProjects < ActiveRecord::Migration[8.1]
  def change
    add_column :projects, :archived_at, :datetime
    add_index :projects, [ :user_id, :archived_at ]
  end
end
