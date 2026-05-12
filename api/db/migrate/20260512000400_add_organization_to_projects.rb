class AddOrganizationToProjects < ActiveRecord::Migration[8.1]
  def change
    add_reference :projects, :organization, foreign_key: true
    add_index :projects, [ :organization_id, :updated_at ]
    add_index :projects, [ :organization_id, :user_id, :updated_at ], name: "index_projects_on_org_user_updated"
  end
end
