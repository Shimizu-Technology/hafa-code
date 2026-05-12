class CreateOrganizationInvitations < ActiveRecord::Migration[8.1]
  def change
    create_table :organization_invitations do |t|
      t.references :organization, null: false, foreign_key: true
      t.references :invited_by, null: false, foreign_key: { to_table: :users }
      t.string :email, null: false
      t.integer :role, null: false, default: 0
      t.string :token, null: false
      t.datetime :accepted_at
      t.datetime :expires_at

      t.timestamps
    end

    add_index :organization_invitations, :token, unique: true
    add_index :organization_invitations, [ :organization_id, :email, :accepted_at ], name: "index_org_invitations_on_org_email_accepted"
  end
end
