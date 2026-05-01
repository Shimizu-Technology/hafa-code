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

ActiveRecord::Schema[8.1].define(version: 2026_04_30_001100) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "project_checkpoints", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "project_id", null: false
    t.jsonb "snapshot", default: {}, null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.index ["project_id", "created_at"], name: "index_project_checkpoints_on_project_id_and_created_at"
    t.index ["project_id"], name: "index_project_checkpoints_on_project_id"
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
    t.bigint "forked_from_id"
    t.string "kind", null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.string "visibility", default: "private", null: false
    t.index ["forked_from_id"], name: "index_projects_on_forked_from_id"
    t.index ["user_id", "archived_at"], name: "index_projects_on_user_id_and_archived_at"
    t.index ["user_id", "updated_at"], name: "index_projects_on_user_id_and_updated_at"
    t.index ["user_id"], name: "index_projects_on_user_id"
    t.index ["visibility"], name: "index_projects_on_visibility"
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

  add_foreign_key "project_checkpoints", "projects"
  add_foreign_key "project_files", "projects"
  add_foreign_key "projects", "projects", column: "forked_from_id"
  add_foreign_key "projects", "users"
end
