class HardenOrganizationInvitations < ActiveRecord::Migration[8.1]
  def up
    add_column :organization_invitations, :delivery_status, :string, null: false, default: "pending"
    add_column :organization_invitations, :last_sent_at, :datetime
    add_column :organization_invitations, :send_attempts, :integer, null: false, default: 0
    add_column :organization_invitations, :delivery_error, :string
    add_column :organization_invitations, :provider_message_id, :string

    execute <<~SQL.squish
      UPDATE organization_invitations
      SET email = LOWER(TRIM(email))
    SQL

    execute <<~SQL.squish
      DELETE FROM organization_invitations
      WHERE id IN (
        SELECT older.id
        FROM organization_invitations older
        INNER JOIN organization_invitations newer
          ON newer.organization_id = older.organization_id
          AND newer.email = older.email
          AND newer.accepted_at IS NULL
          AND older.accepted_at IS NULL
          AND newer.id > older.id
      )
    SQL

    remove_index :organization_invitations, name: "index_org_invitations_on_org_email_accepted"
    add_index :organization_invitations,
      [ :organization_id, :email ],
      unique: true,
      where: "accepted_at IS NULL",
      name: "index_org_invitations_on_pending_email"
  end

  def down
    remove_index :organization_invitations, name: "index_org_invitations_on_pending_email"
    add_index :organization_invitations,
      [ :organization_id, :email, :accepted_at ],
      unique: true,
      name: "index_org_invitations_on_org_email_accepted"

    remove_column :organization_invitations, :provider_message_id
    remove_column :organization_invitations, :delivery_error
    remove_column :organization_invitations, :send_attempts
    remove_column :organization_invitations, :last_sent_at
    remove_column :organization_invitations, :delivery_status
  end
end
