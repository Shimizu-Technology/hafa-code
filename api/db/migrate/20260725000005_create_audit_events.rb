class CreateAuditEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :audit_events do |t|
      t.references :actor, foreign_key: { to_table: :users }
      t.references :organization, foreign_key: true
      t.references :target, polymorphic: true
      t.string :action, null: false
      t.jsonb :metadata, null: false, default: {}
      t.timestamps
    end

    add_index :audit_events, [ :organization_id, :created_at ]
    add_index :audit_events, [ :action, :created_at ]
  end
end
