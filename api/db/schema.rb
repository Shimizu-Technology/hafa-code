# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_07_25_000006) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "api_rate_limits", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "key", null: false
    t.integer "request_count", default: 0, null: false
    t.datetime "updated_at", null: false
    t.datetime "window_started_at", null: false
    t.index ["key"], name: "index_api_rate_limits_on_key", unique: true
    t.index ["window_started_at"], name: "index_api_rate_limits_on_window_started_at"
  end

  create_table "audit_events", force: :cascade do |t|
    t.string "action", null: false
    t.bigint "actor_id"
    t.datetime "created_at", null: false
    t.jsonb "metadata", default: {}, null: false
    t.bigint "organization_id"
    t.bigint "target_id"
    t.string "target_type"
    t.datetime "updated_at", null: false
    t.index ["action", "created_at"], name: "index_audit_events_on_action_and_created_at"
    t.index ["actor_id"], name: "index_audit_events_on_actor_id"
    t.index ["organization_id", "created_at"], name: "index_audit_events_on_organization_id_and_created_at"
    t.index ["organization_id"], name: "index_audit_events_on_organization_id"
    t.index ["target_type", "target_id"], name: "index_audit_events_on_target"
  end

  create_table "organization_invitations", force: :cascade do |t|
    t.datetime "accepted_at"
    t.datetime "created_at", null: false
    t.string "delivery_error"
    t.string "delivery_status", default: "pending", null: false
    t.string "email", null: false
    t.datetime "expires_at"
    t.bigint "invited_by_id", null: false
    t.datetime "last_sent_at"
    t.bigint "organization_id", null: false
    t.string "provider_message_id"
    t.integer "role", default: 0, null: false
    t.integer "send_attempts", default: 0, null: false
    t.string "token", null: false
    t.datetime "updated_at", null: false
    t.index ["invited_by_id"], name: "index_organization_invitations_on_invited_by_id"
    t.index ["organization_id", "email"], name: "index_org_invitations_on_pending_email", unique: true, where: "(accepted_at IS NULL)"
    t.index ["organization_id"], name: "index_organization_invitations_on_organization_id"
    t.index ["token"], name: "index_organization_invitations_on_token", unique: true
  end

  create_table "organization_memberships", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "organization_id", null: false
    t.integer "role", default: 0, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["organization_id", "user_id"], name: "index_org_memberships_on_org_and_user", unique: true
    t.index ["organization_id"], name: "index_organization_memberships_on_organization_id"
    t.index ["user_id", "organization_id"], name: "index_org_memberships_on_user_and_org"
    t.index ["user_id"], name: "index_organization_memberships_on_user_id"
  end

  create_table "organizations", force: :cascade do |t|
    t.datetime "archived_at"
    t.datetime "created_at", null: false
    t.bigint "created_by_id", null: false
    t.string "name", null: false
    t.string "school_year"
    t.string "slug", null: false
    t.datetime "updated_at", null: false
    t.index ["archived_at"], name: "index_organizations_on_archived_at"
    t.index ["created_by_id"], name: "index_organizations_on_created_by_id"
    t.index ["slug"], name: "index_organizations_on_slug", unique: true
  end

  create_table "project_checkpoints", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "project_id", null: false
    t.jsonb "snapshot", default: {}, null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.index ["project_id", "created_at"], name: "index_project_checkpoints_on_project_id_and_created_at"
    t.index ["project_id"], name: "index_project_checkpoints_on_project_id"
  end

  create_table "project_comment_reads", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "project_id", null: false
    t.datetime "read_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["project_id", "user_id"], name: "index_project_comment_reads_on_project_id_and_user_id", unique: true
    t.index ["project_id"], name: "index_project_comment_reads_on_project_id"
    t.index ["user_id"], name: "index_project_comment_reads_on_user_id"
  end

  create_table "project_comments", force: :cascade do |t|
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.datetime "edited_at"
    t.string "file_path"
    t.integer "line_number"
    t.bigint "project_id", null: false
    t.datetime "resolved_at"
    t.bigint "resolved_by_id"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["project_id", "created_at"], name: "index_project_comments_on_project_id_and_created_at"
    t.index ["project_id", "resolved_at"], name: "index_project_comments_on_project_id_and_resolved_at"
    t.index ["project_id"], name: "index_project_comments_on_project_id"
    t.index ["resolved_by_id"], name: "index_project_comments_on_resolved_by_id"
    t.index ["user_id"], name: "index_project_comments_on_user_id"
  end

  create_table "project_files", force: :cascade do |t|
    t.text "content", default: "", null: false
    t.datetime "created_at", null: false
    t.string "language", null: false
    t.string "path", null: false
    t.integer "position", default: 0, null: false
    t.bigint "project_id", null: false
    t.datetime "updated_at", null: false
    t.index ["project_id", "path"], name: "index_project_files_on_project_id_and_path", unique: true
    t.index ["project_id", "position"], name: "index_project_files_on_project_id_and_position"
    t.index ["project_id"], name: "index_project_files_on_project_id"
  end

  create_table "project_shares", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at"
    t.string "kind", null: false
    t.jsonb "snapshot", default: {}, null: false
    t.string "title", null: false
    t.string "token", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_project_shares_on_created_at"
    t.index ["token"], name: "index_project_shares_on_token", unique: true
  end

  create_table "projects", force: :cascade do |t|
    t.datetime "archived_at"
    t.datetime "created_at", null: false
    t.string "entry_path"
    t.bigint "forked_from_id"
    t.string "kind", null: false
    t.integer "lock_version", default: 0, null: false
    t.bigint "organization_id"
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.string "visibility", default: "private", null: false
    t.index ["forked_from_id"], name: "index_projects_on_forked_from_id"
    t.index ["organization_id", "updated_at"], name: "index_projects_on_organization_id_and_updated_at"
    t.index ["organization_id", "user_id", "updated_at"], name: "index_projects_on_org_user_updated"
    t.index ["organization_id"], name: "index_projects_on_organization_id"
    t.index ["user_id", "archived_at"], name: "index_projects_on_user_id_and_archived_at"
    t.index ["user_id", "updated_at"], name: "index_projects_on_user_id_and_updated_at"
    t.index ["user_id"], name: "index_projects_on_user_id"
    t.index ["visibility"], name: "index_projects_on_visibility"
  end

  create_table "solid_queue_blocked_executions", force: :cascade do |t|
    t.string "concurrency_key", null: false
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["concurrency_key", "priority", "job_id"], name: "index_solid_queue_blocked_executions_for_release"
    t.index ["expires_at", "concurrency_key"], name: "index_solid_queue_blocked_executions_for_maintenance"
    t.index ["job_id"], name: "index_solid_queue_blocked_executions_on_job_id", unique: true
  end

  create_table "solid_queue_claimed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.bigint "process_id"
    t.index ["job_id"], name: "index_solid_queue_claimed_executions_on_job_id", unique: true
    t.index ["process_id", "job_id"], name: "index_solid_queue_claimed_executions_on_process_id_and_job_id"
  end

  create_table "solid_queue_failed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "error"
    t.bigint "job_id", null: false
    t.index ["job_id"], name: "index_solid_queue_failed_executions_on_job_id", unique: true
  end

  create_table "solid_queue_jobs", force: :cascade do |t|
    t.string "active_job_id"
    t.text "arguments"
    t.string "class_name", null: false
    t.string "concurrency_key"
    t.datetime "created_at", null: false
    t.datetime "finished_at"
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at"
    t.datetime "updated_at", null: false
    t.index ["active_job_id"], name: "index_solid_queue_jobs_on_active_job_id"
    t.index ["class_name"], name: "index_solid_queue_jobs_on_class_name"
    t.index ["finished_at"], name: "index_solid_queue_jobs_on_finished_at"
    t.index ["queue_name", "finished_at"], name: "index_solid_queue_jobs_for_filtering"
    t.index ["scheduled_at", "finished_at"], name: "index_solid_queue_jobs_for_alerting"
  end

  create_table "solid_queue_pauses", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "queue_name", null: false
    t.index ["queue_name"], name: "index_solid_queue_pauses_on_queue_name", unique: true
  end

  create_table "solid_queue_processes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "hostname"
    t.string "kind", null: false
    t.datetime "last_heartbeat_at", null: false
    t.text "metadata"
    t.string "name", null: false
    t.integer "pid", null: false
    t.bigint "supervisor_id"
    t.index ["last_heartbeat_at"], name: "index_solid_queue_processes_on_last_heartbeat_at"
    t.index ["name", "supervisor_id"], name: "index_solid_queue_processes_on_name_and_supervisor_id", unique: true
    t.index ["supervisor_id"], name: "index_solid_queue_processes_on_supervisor_id"
  end

  create_table "solid_queue_ready_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["job_id"], name: "index_solid_queue_ready_executions_on_job_id", unique: true
    t.index ["priority", "job_id"], name: "index_solid_queue_poll_all"
    t.index ["queue_name", "priority", "job_id"], name: "index_solid_queue_poll_by_queue"
  end

  create_table "solid_queue_recurring_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.datetime "run_at", null: false
    t.string "task_key", null: false
    t.index ["job_id"], name: "index_solid_queue_recurring_executions_on_job_id", unique: true
    t.index ["task_key", "run_at"], name: "index_solid_queue_recurring_executions_on_task_key_and_run_at", unique: true
  end

  create_table "solid_queue_recurring_tasks", force: :cascade do |t|
    t.text "arguments"
    t.string "class_name"
    t.string "command", limit: 2048
    t.datetime "created_at", null: false
    t.text "description"
    t.string "key", null: false
    t.integer "priority", default: 0
    t.string "queue_name"
    t.string "schedule", null: false
    t.boolean "static", default: true, null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_solid_queue_recurring_tasks_on_key", unique: true
    t.index ["static"], name: "index_solid_queue_recurring_tasks_on_static"
  end

  create_table "solid_queue_scheduled_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at", null: false
    t.index ["job_id"], name: "index_solid_queue_scheduled_executions_on_job_id", unique: true
    t.index ["scheduled_at", "priority", "job_id"], name: "index_solid_queue_dispatch_all"
  end

  create_table "solid_queue_semaphores", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.string "key", null: false
    t.datetime "updated_at", null: false
    t.integer "value", default: 1, null: false
    t.index ["expires_at"], name: "index_solid_queue_semaphores_on_expires_at"
    t.index ["key", "value"], name: "index_solid_queue_semaphores_on_key_and_value"
    t.index ["key"], name: "index_solid_queue_semaphores_on_key", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.string "clerk_id", null: false
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "first_name"
    t.string "last_name"
    t.datetime "last_sign_in_at"
    t.integer "role", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index "lower((email)::text)", name: "index_users_on_lower_email", unique: true
    t.index ["clerk_id"], name: "index_users_on_clerk_id", unique: true
  end

  add_foreign_key "audit_events", "organizations"
  add_foreign_key "audit_events", "users", column: "actor_id"
  add_foreign_key "organization_invitations", "organizations"
  add_foreign_key "organization_invitations", "users", column: "invited_by_id"
  add_foreign_key "organization_memberships", "organizations"
  add_foreign_key "organization_memberships", "users"
  add_foreign_key "organizations", "users", column: "created_by_id"
  add_foreign_key "project_checkpoints", "projects"
  add_foreign_key "project_comment_reads", "projects"
  add_foreign_key "project_comment_reads", "users"
  add_foreign_key "project_comments", "projects"
  add_foreign_key "project_comments", "users"
  add_foreign_key "project_comments", "users", column: "resolved_by_id"
  add_foreign_key "project_files", "projects"
  add_foreign_key "projects", "organizations"
  add_foreign_key "projects", "projects", column: "forked_from_id"
  add_foreign_key "projects", "users"
  add_foreign_key "solid_queue_blocked_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_claimed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_failed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_ready_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_recurring_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_scheduled_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
end
