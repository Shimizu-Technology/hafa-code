class AddEntryPathToProjects < ActiveRecord::Migration[8.1]
  def change
    add_column :projects, :entry_path, :string
  end
end
