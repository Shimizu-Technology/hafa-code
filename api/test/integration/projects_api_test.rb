require "test_helper"

class ProjectsApiTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(
      clerk_id: "test_clerk_1",
      email: "student@example.com",
      first_name: "Test",
      last_name: "Student"
    )
    @headers = {
      "Authorization" => "Bearer test_token_#{@user.id}",
      "Content-Type" => "application/json"
    }
    Rails.cache.clear
  end

  test "creates lists updates and deletes projects for authenticated user" do
    post "/api/v1/projects",
      params: {
        title: "Ruby Playground",
        kind: "ruby",
        entry_path: "main.rb",
        files: [ { path: "main.rb", language: "ruby", content: "puts 'hafa'" } ]
      }.to_json,
      headers: @headers

    assert_response :created
    project_id = response.parsed_body.dig("project", "id")
    assert_equal "Ruby Playground", response.parsed_body.dig("project", "title")
    assert_equal "main.rb", response.parsed_body.dig("project", "entry_path")
    assert_equal 1, response.parsed_body.dig("project", "files").length

    get "/api/v1/projects", headers: @headers
    assert_response :success
    assert_equal 1, response.parsed_body.fetch("projects").length

    patch "/api/v1/projects/#{project_id}",
      params: {
        title: "Updated Ruby",
        kind: "ruby",
        entry_path: "lib/helper.rb",
        files: [
          { path: "main.rb", language: "ruby", content: "require_relative './lib/helper'\nputs helper" },
          { path: "lib/helper.rb", language: "ruby", content: "def helper = 'updated'" }
        ]
      }.to_json,
      headers: @headers

    assert_response :success
    assert_equal "Updated Ruby", response.parsed_body.dig("project", "title")
    assert_equal "lib/helper.rb", response.parsed_body.dig("project", "entry_path")
    assert_equal 2, response.parsed_body.dig("project", "files").length

    delete "/api/v1/projects/#{project_id}", headers: @headers
    assert_response :no_content
  end

  test "rejects projects without valid files" do
    post "/api/v1/projects",
      params: {
        title: "Empty Project",
        kind: "ruby",
        files: []
      }.to_json,
      headers: @headers

    assert_response :unprocessable_entity
    assert_includes response.parsed_body.fetch("errors"), "Project files must include at least one file"
  end

  test "rejects malformed file entries without crashing" do
    post "/api/v1/projects",
      params: {
        title: "Malformed Project",
        kind: "ruby",
        files: [ "not a file" ]
      }.to_json,
      headers: @headers

    assert_response :unprocessable_entity
    assert_includes response.parsed_body.fetch("errors"), "Project files must include at least one file"
  end

  test "rejects unsafe file paths and entry paths" do
    post "/api/v1/projects",
      params: {
        title: "Unsafe Project",
        kind: "ruby",
        entry_path: "../secret.rb",
        files: [ { path: "../secret.rb", language: "ruby", content: "puts 'nope'" } ]
      }.to_json,
      headers: @headers

    assert_response :unprocessable_entity
    assert response.parsed_body.fetch("errors").any? { |error| error.include?("Path") }

    post "/api/v1/projects",
      params: {
        title: "Missing Entry",
        kind: "javascript",
        entry_path: "missing.js",
        files: [ { path: "main.js", language: "javascript", content: "console.log('hafa')" } ]
      }.to_json,
      headers: @headers

    assert_response :unprocessable_entity
    assert_includes response.parsed_body.fetch("errors"), "Entry path must match a project file"

    post "/api/v1/projects",
      params: {
        title: "Long Path",
        kind: "ruby",
        entry_path: "#{'a' * 158}.rb",
        files: [ { path: "#{'a' * 158}.rb", language: "ruby", content: "puts 'too long'" } ]
      }.to_json,
      headers: @headers

    assert_response :unprocessable_entity
    assert response.parsed_body.fetch("errors").any? { |error| error.include?("Path") && error.include?("160 characters") }
  end

  test "keeps existing files when update with invalid files fails" do
    project = @user.projects.create!(
      title: "Ruby Playground",
      kind: "ruby",
      project_files: [ ProjectFile.new(path: "main.rb", language: "ruby", content: "puts 'hafa'") ]
    )

    patch "/api/v1/projects/#{project.id}",
      params: {
        title: "Broken Update",
        kind: "ruby",
        files: []
      }.to_json,
      headers: @headers

    assert_response :unprocessable_entity
    assert_equal "Ruby Playground", project.reload.title
    assert_equal [ "main.rb" ], project.project_files.pluck(:path)
  end

  test "archives and restores projects" do
    project = @user.projects.create!(
      title: "Ruby Playground",
      kind: "ruby",
      project_files: [ ProjectFile.new(path: "main.rb", language: "ruby", content: "puts 'hafa'") ]
    )

    patch "/api/v1/projects/#{project.id}/archive", headers: @headers
    assert_response :success
    assert_not_nil response.parsed_body.dig("project", "archived_at")
    assert_not_nil project.reload.archived_at

    get "/api/v1/projects", headers: @headers
    assert_response :success
    archived_project = response.parsed_body.fetch("projects").find { |candidate| candidate.fetch("id") == project.id }
    assert_not_nil archived_project.fetch("archived_at")

    patch "/api/v1/projects/#{project.id}/unarchive", headers: @headers
    assert_response :success
    assert_nil response.parsed_body.dig("project", "archived_at")
    assert_nil project.reload.archived_at
  end

  test "does not allow archived timestamp through generic project updates" do
    project = @user.projects.create!(
      title: "Ruby Playground",
      kind: "ruby",
      project_files: [ ProjectFile.new(path: "main.rb", language: "ruby", content: "puts 'hafa'") ]
    )

    patch "/api/v1/projects/#{project.id}",
      params: {
        title: "Updated Ruby",
        kind: "ruby",
        archived_at: 2.days.ago.iso8601
      }.to_json,
      headers: @headers

    assert_response :success
    assert_nil project.reload.archived_at
  end

  test "creates and restores project checkpoints" do
    project = @user.projects.create!(
      title: "Ruby Playground",
      kind: "ruby",
      project_files: [ ProjectFile.new(path: "main.rb", language: "ruby", content: "puts 'before'") ]
    )

    post "/api/v1/projects/#{project.id}/checkpoints",
      params: { title: "Before edit" }.to_json,
      headers: @headers

    assert_response :created
    checkpoint_id = response.parsed_body.dig("checkpoint", "id")
    assert_equal "Before edit", response.parsed_body.dig("checkpoint", "title")

    patch "/api/v1/projects/#{project.id}",
      params: {
        title: "Edited Ruby",
        kind: "ruby",
        files: [ { path: "main.rb", language: "ruby", content: "puts 'after'" } ]
      }.to_json,
      headers: @headers

    assert_response :success
    assert_equal "puts 'after'", project.reload.project_files.first.content

    post "/api/v1/projects/#{project.id}/checkpoints/#{checkpoint_id}/restore", headers: @headers

    assert_response :success
    assert_equal "Ruby Playground", response.parsed_body.dig("project", "title")
    assert_equal "puts 'before'", response.parsed_body.dig("project", "files", 0, "content")

    get "/api/v1/projects/#{project.id}/checkpoints", headers: @headers
    assert_response :success
    assert_equal 1, response.parsed_body.fetch("checkpoints").length
    assert_not response.parsed_body.dig("checkpoints", 0).key?("snapshot")
  end

  test "restores checkpoint when entry path is not in current files" do
    project = @user.projects.create!(
      title: "Ruby Playground",
      kind: "ruby",
      entry_path: "start.rb",
      project_files: [
        ProjectFile.new(path: "start.rb", language: "ruby", content: "require_relative 'helper'\nputs helper"),
        ProjectFile.new(path: "helper.rb", language: "ruby", content: "def helper = 'before'")
      ]
    )

    post "/api/v1/projects/#{project.id}/checkpoints",
      params: { title: "Multi-file entry" }.to_json,
      headers: @headers

    assert_response :created
    checkpoint_id = response.parsed_body.dig("checkpoint", "id")

    patch "/api/v1/projects/#{project.id}",
      params: {
        title: "Different files",
        kind: "ruby",
        entry_path: "main.rb",
        files: [ { path: "main.rb", language: "ruby", content: "puts 'after'" } ]
      }.to_json,
      headers: @headers

    assert_response :success
    assert_equal "main.rb", project.reload.entry_path
    assert_equal [ "main.rb" ], project.project_files.pluck(:path)

    post "/api/v1/projects/#{project.id}/checkpoints/#{checkpoint_id}/restore", headers: @headers

    assert_response :success
    assert_equal "start.rb", response.parsed_body.dig("project", "entry_path")
    assert_equal [ "start.rb", "helper.rb" ], response.parsed_body.dig("project", "files").map { |file| file.fetch("path") }
  end

  test "keeps only the newest project checkpoints" do
    project = @user.projects.create!(
      title: "Ruby Playground",
      kind: "ruby",
      project_files: [ ProjectFile.new(path: "main.rb", language: "ruby", content: "puts 'hafa'") ]
    )

    31.times do |index|
      post "/api/v1/projects/#{project.id}/checkpoints",
        params: { title: "Checkpoint #{index}" }.to_json,
        headers: @headers

      assert_response :created
    end

    get "/api/v1/projects/#{project.id}/checkpoints", headers: @headers

    assert_response :success
    checkpoints = response.parsed_body.fetch("checkpoints")
    assert_equal 30, checkpoints.length
    assert_equal "Checkpoint 30", checkpoints.first.fetch("title")
    assert_not_includes checkpoints.map { |checkpoint| checkpoint.fetch("title") }, "Checkpoint 0"
    assert_equal 30, project.project_checkpoints.count
  end

  test "rejects oversized project checkpoints" do
    project = @user.projects.create!(
      title: "Large Ruby Playground",
      kind: "ruby",
      project_files: [ ProjectFile.new(path: "main.rb", language: "ruby", content: "puts 'small'") ]
    )
    project.project_files.first.update_column(:content, "x" * 500_001)

    post "/api/v1/projects/#{project.id}/checkpoints",
      params: { title: "Too large" }.to_json,
      headers: @headers

    assert_response :unprocessable_entity
    assert_includes response.parsed_body.fetch("errors"), "File content is too large for checkpoint"
    assert_equal 0, project.project_checkpoints.count
  end

  test "creates and reads public share snapshots without authentication" do
    post "/api/v1/shares",
      params: {
        title: "Shared Web Page",
        kind: "web",
        entry_path: "pages/about.html",
        files: [
          { path: "index.html", language: "html", content: "<button>Hello</button>" },
          { path: "pages/about.html", language: "html", content: "<h1>About</h1>" },
          { path: "style.css", language: "css", content: "button { color: red; }" }
        ]
      }.to_json,
      headers: { "Content-Type" => "application/json" }

    assert_response :created
    token = response.parsed_body.dig("share", "token")
    assert_not_empty token
    assert_equal "Shared Web Page", response.parsed_body.dig("share", "snapshot", "title")
    assert_equal "pages/about.html", response.parsed_body.dig("share", "snapshot", "entryPath")
    assert_not_nil response.parsed_body.dig("share", "expires_at")

    get "/api/v1/shares/#{token}", headers: { "Content-Type" => "application/json" }

    assert_response :success
    assert_equal "web", response.parsed_body.dig("share", "kind")
    assert_equal 3, response.parsed_body.dig("share", "snapshot", "files").length
  end

  test "does not serve expired share snapshots" do
    share = ProjectShare.create!(
      title: "Expired",
      kind: "ruby",
      expires_at: 1.minute.ago,
      snapshot: {
        title: "Expired",
        kind: "ruby",
        files: [ { path: "main.rb", language: "ruby", content: "puts 'old'" } ]
      }
    )

    get "/api/v1/shares/#{share.token}", headers: { "Content-Type" => "application/json" }

    assert_response :not_found
  end

  test "rate limits public share creation" do
    original_cache = Rails.cache
    Rails.cache = ActiveSupport::Cache::MemoryStore.new
    payload = {
      title: "Shared Ruby",
      kind: "ruby",
      files: [ { path: "main.rb", language: "ruby", content: "puts 'hafa'" } ]
    }

    60.times do
      post "/api/v1/shares", params: payload.to_json, headers: { "Content-Type" => "application/json" }
      assert_response :created
    end

    post "/api/v1/shares", params: payload.to_json, headers: { "Content-Type" => "application/json" }

    assert_response :too_many_requests
  ensure
    Rails.cache = original_cache
  end

  test "organization instructors can view student private organization projects but cannot edit them" do
    instructor = User.create!(
      clerk_id: "test_clerk_instructor",
      email: "teacher@example.com",
      first_name: "Test",
      last_name: "Teacher"
    )
    organization = Organization.create!(name: "Code School", created_by: instructor)
    organization.organization_memberships.create!(user: instructor, role: :instructor)
    organization.organization_memberships.create!(user: @user, role: :student)

    student_project = @user.projects.create!(
      organization: organization,
      title: "Student Ruby",
      kind: "ruby",
      visibility: "private",
      project_files: [ ProjectFile.new(path: "main.rb", language: "ruby", content: "puts 'student'") ]
    )

    instructor_headers = {
      "Authorization" => "Bearer test_token_#{instructor.id}",
      "Content-Type" => "application/json"
    }

    get "/api/v1/projects/#{student_project.id}", headers: instructor_headers
    assert_response :success
    assert_equal "Student Ruby", response.parsed_body.dig("project", "title")
    assert_equal "teacher@example.com", instructor.email

    patch "/api/v1/projects/#{student_project.id}",
      params: {
        title: "Edited by teacher",
        kind: "ruby",
        files: [ { path: "main.rb", language: "ruby", content: "puts 'changed'" } ]
      }.to_json,
      headers: instructor_headers

    assert_response :not_found
    assert_equal "Student Ruby", student_project.reload.title

    get "/api/v1/organizations/#{organization.id}/members", headers: instructor_headers
    assert_response :success
    assert_equal [ "teacher@example.com", "student@example.com" ].sort, response.parsed_body.fetch("members").map { |member| member.fetch("email") }.sort
  end

  test "only platform mentors and admins can create organizations" do
    post "/api/v1/organizations",
      params: { name: "Student Org" }.to_json,
      headers: @headers

    assert_response :forbidden

    mentor = User.create!(
      clerk_id: "test_clerk_mentor",
      email: "mentor@example.com",
      first_name: "Test",
      last_name: "Mentor",
      role: :mentor
    )
    mentor_headers = {
      "Authorization" => "Bearer test_token_#{mentor.id}",
      "Content-Type" => "application/json"
    }

    post "/api/v1/organizations",
      params: { name: "Mentor Org" }.to_json,
      headers: mentor_headers

    assert_response :created
    organization = Organization.find(response.parsed_body.dig("organization", "id"))
    assert_equal "Mentor Org", organization.name
    assert organization.organization_memberships.find_by(user: mentor).owner?
  end

  test "accepting a stronger invitation updates an existing membership" do
    instructor = User.create!(
      clerk_id: "test_clerk_owner",
      email: "owner@example.com",
      first_name: "Org",
      last_name: "Owner",
      role: :mentor
    )
    organization = Organization.create!(name: "Code School", created_by: instructor)
    organization.organization_memberships.create!(user: instructor, role: :owner)
    membership = organization.organization_memberships.create!(user: @user, role: :student)
    invitation = organization.organization_invitations.create!(
      invited_by: instructor,
      email: @user.email,
      role: :instructor
    )

    post "/api/v1/invitations/#{invitation.token}/accept", headers: @headers

    assert_response :success
    assert_equal "instructor", membership.reload.role
    assert_not_nil invitation.reload.accepted_at
  end

  test "accepting a weaker invitation does not downgrade an existing owner" do
    owner = User.create!(
      clerk_id: "test_clerk_direct_owner",
      email: "owner-student@example.com",
      first_name: "Direct",
      last_name: "Owner"
    )
    organization = Organization.create!(name: "Code School", created_by: owner)
    membership = organization.organization_memberships.create!(user: owner, role: :owner)
    invitation = organization.organization_invitations.create!(
      invited_by: owner,
      email: owner.email,
      role: :student
    )
    owner_headers = {
      "Authorization" => "Bearer test_token_#{owner.id}",
      "Content-Type" => "application/json"
    }

    post "/api/v1/invitations/#{invitation.token}/accept", headers: owner_headers

    assert_response :success
    assert_equal "owner", membership.reload.role
    assert_not_nil invitation.reload.accepted_at
  end

  test "organization students cannot view another student's private organization project" do
    other_student = User.create!(
      clerk_id: "test_clerk_2",
      email: "other@example.com",
      first_name: "Other",
      last_name: "Student"
    )
    organization = Organization.create!(name: "Code School", created_by: @user)
    organization.organization_memberships.create!(user: @user, role: :owner)
    organization.organization_memberships.create!(user: other_student, role: :student)

    private_project = @user.projects.create!(
      organization: organization,
      title: "Private Ruby",
      kind: "ruby",
      visibility: "private",
      project_files: [ ProjectFile.new(path: "main.rb", language: "ruby", content: "puts 'private'") ]
    )

    other_headers = {
      "Authorization" => "Bearer test_token_#{other_student.id}",
      "Content-Type" => "application/json"
    }

    get "/api/v1/projects/#{private_project.id}", headers: other_headers
    assert_response :forbidden

    private_project.update!(visibility: "organization")
    get "/api/v1/projects/#{private_project.id}", headers: other_headers
    assert_response :success
  end
end
