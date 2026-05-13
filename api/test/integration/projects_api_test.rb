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

  test "rejects organization visibility without an organization" do
    post "/api/v1/projects",
      params: {
        title: "Orphan Organization Project",
        kind: "ruby",
        visibility: "organization",
        files: [ { path: "main.rb", language: "ruby", content: "puts 'orphan'" } ]
      }.to_json,
      headers: @headers

    assert_response :unprocessable_entity
    assert_includes response.parsed_body.fetch("errors"), "Organization must be present for organization visibility"

    project = @user.projects.create!(
      title: "Personal Ruby",
      kind: "ruby",
      visibility: "private",
      project_files: [ ProjectFile.new(path: "main.rb", language: "ruby", content: "puts 'personal'") ]
    )

    patch "/api/v1/projects/#{project.id}",
      params: {
        title: "Personal Ruby",
        kind: "ruby",
        visibility: "organization"
      }.to_json,
      headers: @headers

    assert_response :unprocessable_entity
    assert_includes response.parsed_body.fetch("errors"), "Organization must be present for organization visibility"
    assert_equal "private", project.reload.visibility
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
    owner = response.parsed_body.dig("project", "owner")
    assert_equal @user.id, owner.fetch("id")
    assert_equal @user.full_name, owner.fetch("full_name")
    assert_not owner.key?("email")
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

  test "platform admins can list and open private organization projects" do
    admin = User.create!(
      clerk_id: "test_clerk_admin",
      email: "admin@example.com",
      first_name: "Test",
      last_name: "Admin",
      role: :admin
    )
    organization = Organization.create!(name: "Admin School", created_by: admin)
    organization.organization_memberships.create!(user: @user, role: :student)
    private_project = @user.projects.create!(
      organization: organization,
      title: "Admin Visible Ruby",
      kind: "ruby",
      visibility: "private",
      project_files: [ ProjectFile.new(path: "main.rb", language: "ruby", content: "puts 'admin visible'") ]
    )
    admin_headers = {
      "Authorization" => "Bearer test_token_#{admin.id}",
      "Content-Type" => "application/json"
    }

    get "/api/v1/organizations/#{organization.id}/projects", headers: admin_headers

    assert_response :success
    assert_equal [ private_project.id ], response.parsed_body.fetch("projects").map { |project| project.fetch("id") }

    get "/api/v1/projects", params: { organization_id: organization.id }, headers: admin_headers

    assert_response :success
    assert_equal [ private_project.id ], response.parsed_body.fetch("projects").map { |project| project.fetch("id") }

    get "/api/v1/organizations/#{organization.id}/members", headers: admin_headers

    assert_response :success
    assert_equal [ "student@example.com" ], response.parsed_body.fetch("members").map { |member| member.fetch("email") }

    get "/api/v1/projects/#{private_project.id}", headers: admin_headers

    assert_response :success
    assert_equal "Admin Visible Ruby", response.parsed_body.dig("project", "title")
  end

  test "bad organization ids return not found for project list and create" do
    missing_id = SecureRandom.uuid

    get "/api/v1/projects", params: { organization_id: missing_id }, headers: @headers

    assert_response :not_found
    assert_equal "Not found", response.parsed_body.fetch("error")

    post "/api/v1/projects",
      params: {
        organization_id: missing_id,
        title: "Missing Org Ruby",
        kind: "ruby",
        files: [ { path: "main.rb", language: "ruby", content: "puts 'missing'" } ]
      }.to_json,
      headers: @headers

    assert_response :not_found
    assert_equal "Not found", response.parsed_body.fetch("error")
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

  test "accepting an invitation retries when membership is created concurrently" do
    owner = User.create!(
      clerk_id: "test_clerk_retry_owner",
      email: "retry-owner@example.com",
      first_name: "Retry",
      last_name: "Owner",
      role: :mentor
    )
    organization = Organization.create!(name: "Retry School", created_by: owner)
    organization.organization_memberships.create!(user: owner, role: :owner)
    invitation = organization.organization_invitations.create!(
      invited_by: owner,
      email: @user.email,
      role: :instructor
    )
    original_lookup = OrganizationMembership.method(:find_or_initialize_by)
    first_lookup = true

    begin
      OrganizationMembership.define_singleton_method(:find_or_initialize_by) do |attributes|
        unless first_lookup
          next original_lookup.call(attributes)
        end

        first_lookup = false
        membership = OrganizationMembership.new(attributes)
        membership.define_singleton_method(:save!) do
          OrganizationMembership.create!(
            organization: attributes.fetch(:organization),
            user: attributes.fetch(:user),
            role: :student
          )
          raise ActiveRecord::RecordNotUnique, "membership already exists"
        end
        membership
      end

      post "/api/v1/invitations/#{invitation.token}/accept", headers: @headers
    ensure
      OrganizationMembership.define_singleton_method(:find_or_initialize_by, original_lookup)
    end

    assert_response :success
    assert_equal "instructor", OrganizationMembership.find_by!(organization: organization, user: @user).role
    assert_not_nil invitation.reload.accepted_at
  end

  test "accepting an invitation succeeds when concurrent membership retries are exhausted" do
    owner = User.create!(
      clerk_id: "test_clerk_exhausted_owner",
      email: "exhausted-owner@example.com",
      first_name: "Exhausted",
      last_name: "Owner",
      role: :mentor
    )
    organization = Organization.create!(name: "Exhausted Retry School", created_by: owner)
    organization.organization_memberships.create!(user: owner, role: :owner)
    invitation = organization.organization_invitations.create!(
      invited_by: owner,
      email: @user.email,
      role: :instructor
    )
    original_lookup = OrganizationMembership.method(:find_or_initialize_by)
    attempts = 0

    begin
      OrganizationMembership.define_singleton_method(:find_or_initialize_by) do |attributes|
        if attempts < 2
          attempts += 1
          membership = OrganizationMembership.new(attributes)
          membership.define_singleton_method(:save!) do
            OrganizationMembership.find_or_create_by!(
              organization: attributes.fetch(:organization),
              user: attributes.fetch(:user)
            ) { |existing| existing.role = :student }
            raise ActiveRecord::RecordNotUnique, "membership already exists"
          end
          next membership
        end

        original_lookup.call(attributes)
      end

      post "/api/v1/invitations/#{invitation.token}/accept", headers: @headers
    ensure
      OrganizationMembership.define_singleton_method(:find_or_initialize_by, original_lookup)
    end

    assert_response :success
    assert_equal "instructor", OrganizationMembership.find_by!(organization: organization, user: @user).role
    assert_not_nil invitation.reload.accepted_at
  end

  test "accepting an invitation rolls back membership when marking accepted fails" do
    owner = User.create!(
      clerk_id: "test_clerk_atomic_owner",
      email: "atomic-owner@example.com",
      first_name: "Atomic",
      last_name: "Owner",
      role: :mentor
    )
    organization = Organization.create!(name: "Atomic School", created_by: owner)
    organization.organization_memberships.create!(user: owner, role: :owner)
    invitation = organization.organization_invitations.create!(
      invited_by: owner,
      email: @user.email,
      role: :instructor
    )
    original_update = OrganizationInvitation.instance_method(:update!)

    begin
      OrganizationInvitation.define_method(:update!) do |*args, **kwargs|
        attributes = args.first || kwargs
        if id == invitation.id && attributes.respond_to?(:key?) && attributes.key?(:accepted_at)
          raise ActiveRecord::StatementInvalid, "transient accepted_at failure"
        end

        original_update.bind(self).call(*args, **kwargs)
      end

      assert_raises(ActiveRecord::StatementInvalid) do
        post "/api/v1/invitations/#{invitation.token}/accept", headers: @headers
      end
    ensure
      OrganizationInvitation.define_method(:update!, original_update)
    end

    assert_nil OrganizationMembership.find_by(organization: organization, user: @user)
    assert_nil invitation.reload.accepted_at
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

  test "organization invitations reject invalid role and email cleanly" do
    owner = User.create!(
      clerk_id: "test_clerk_invite_owner",
      email: "invite-owner@example.com",
      first_name: "Invite",
      last_name: "Owner",
      role: :mentor
    )
    organization = Organization.create!(name: "Invite School", created_by: owner)
    organization.organization_memberships.create!(user: owner, role: :owner)
    owner_headers = {
      "Authorization" => "Bearer test_token_#{owner.id}",
      "Content-Type" => "application/json"
    }

    post "/api/v1/organizations/#{organization.id}/invite",
      params: { email: "student@example.com", role: "owner" }.to_json,
      headers: owner_headers

    assert_response :unprocessable_entity
    assert_equal [ "Role is not valid" ], response.parsed_body.fetch("errors")

    post "/api/v1/organizations/#{organization.id}/invite",
      params: { email: "not-an-email", role: "student" }.to_json,
      headers: owner_headers

    assert_response :unprocessable_entity
    assert_includes response.parsed_body.fetch("errors"), "Email is invalid"

    original_send_invite = OrganizationInviteEmailService.method(:send_invite)
    OrganizationInviteEmailService.define_singleton_method(:send_invite) { |**| false }

    begin
      post "/api/v1/organizations/#{organization.id}/invite",
        params: { email: "student@example.com", role: "student" }.to_json,
        headers: owner_headers
    ensure
      OrganizationInviteEmailService.define_singleton_method(:send_invite, original_send_invite)
    end

    assert_response :created
    invitation = response.parsed_body.fetch("invitation")
    assert_equal "student@example.com", invitation.fetch("email")
    assert_equal "student", invitation.fetch("role")
    assert_equal false, invitation.fetch("email_sent")
    assert_match "#invite=", invitation.fetch("invitation_url")

    instructor = User.create!(
      clerk_id: "test_clerk_invite_instructor",
      email: "org-instructor@example.com",
      first_name: "Org",
      last_name: "Instructor"
    )
    organization.organization_memberships.create!(user: instructor, role: :instructor)
    instructor_headers = {
      "Authorization" => "Bearer test_token_#{instructor.id}",
      "Content-Type" => "application/json"
    }

    post "/api/v1/organizations/#{organization.id}/invite",
      params: { email: "peer-instructor@example.com", role: "instructor" }.to_json,
      headers: instructor_headers

    assert_response :forbidden

    post "/api/v1/organizations/#{organization.id}/invite",
      params: { email: "new-student@example.com", role: "student" }.to_json,
      headers: instructor_headers

    assert_response :created
    assert_equal "student", response.parsed_body.dig("invitation", "role")

    organization.organization_invitations.create!(
      invited_by: owner,
      email: "accepted@example.com",
      role: :student,
      accepted_at: Time.current
    )
    organization.organization_invitations.create!(
      invited_by: owner,
      email: "expired@example.com",
      role: :student,
      expires_at: 1.day.ago
    )

    get "/api/v1/organizations/#{organization.id}/invitations", headers: owner_headers

    assert_response :success
    invitations = response.parsed_body.fetch("invitations")
    assert_equal [ "new-student@example.com", "student@example.com" ], invitations.map { |candidate| candidate.fetch("email") }
    invitations.each do |pending_invitation|
      assert pending_invitation.key?("token")
      assert pending_invitation.key?("invitation_url")
    end

    student_invitation_id = invitations.find { |candidate| candidate.fetch("email") == "student@example.com" }.fetch("id")
    original_send_invite = OrganizationInviteEmailService.method(:send_invite)
    OrganizationInviteEmailService.define_singleton_method(:send_invite) { |**| false }

    begin
      post "/api/v1/organizations/#{organization.id}/invitations/#{student_invitation_id}/resend",
        headers: owner_headers
    ensure
      OrganizationInviteEmailService.define_singleton_method(:send_invite, original_send_invite)
    end

    assert_response :success
    assert_equal false, response.parsed_body.dig("invitation", "email_sent")
    assert_match "#invite=", response.parsed_body.dig("invitation", "invitation_url")

    revoked_token = response.parsed_body.dig("invitation", "token")
    delete "/api/v1/organizations/#{organization.id}/invitations/#{student_invitation_id}",
      headers: owner_headers

    assert_response :no_content

    get "/api/v1/invitations/#{revoked_token}", headers: owner_headers

    assert_response :not_found
  end

  test "organization owners can manage members and protect the final owner" do
    owner = User.create!(
      clerk_id: "test_clerk_member_owner",
      email: "member-owner@example.com",
      first_name: "Member",
      last_name: "Owner",
      role: :mentor
    )
    instructor = User.create!(
      clerk_id: "test_clerk_member_instructor",
      email: "member-instructor@example.com",
      first_name: "Member",
      last_name: "Instructor"
    )
    student = User.create!(
      clerk_id: "test_clerk_member_student",
      email: "member-student@example.com",
      first_name: "Member",
      last_name: "Student"
    )
    organization = Organization.create!(name: "Member School", created_by: owner)
    owner_membership = organization.organization_memberships.create!(user: owner, role: :owner)
    organization.organization_memberships.create!(user: instructor, role: :instructor)
    student_membership = organization.organization_memberships.create!(user: student, role: :student)
    owner_headers = {
      "Authorization" => "Bearer test_token_#{owner.id}",
      "Content-Type" => "application/json"
    }
    instructor_headers = {
      "Authorization" => "Bearer test_token_#{instructor.id}",
      "Content-Type" => "application/json"
    }

    patch "/api/v1/organizations/#{organization.id}/members/#{student_membership.id}",
      params: { role: "instructor" }.to_json,
      headers: instructor_headers

    assert_response :forbidden

    patch "/api/v1/organizations/#{organization.id}/members/#{student_membership.id}",
      params: { role: "instructor" }.to_json,
      headers: owner_headers

    assert_response :success
    assert_equal "instructor", student_membership.reload.role
    assert_equal "instructor", response.parsed_body.dig("member", "organization_role")

    patch "/api/v1/organizations/#{organization.id}/members/#{owner_membership.id}",
      params: { role: "student" }.to_json,
      headers: owner_headers

    assert_response :unprocessable_entity
    assert_equal [ "Organization must keep at least one owner" ], response.parsed_body.fetch("errors")

    delete "/api/v1/organizations/#{organization.id}/members/#{student_membership.id}",
      headers: owner_headers

    assert_response :no_content
    assert_nil OrganizationMembership.find_by(id: student_membership.id)
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

  test "organization listings do not expose unlisted projects to student members" do
    other_student = User.create!(
      clerk_id: "test_clerk_unlisted_member",
      email: "unlisted-member@example.com",
      first_name: "Other",
      last_name: "Student"
    )
    organization = Organization.create!(name: "Unlisted School", created_by: @user)
    organization.organization_memberships.create!(user: @user, role: :owner)
    organization.organization_memberships.create!(user: other_student, role: :student)
    organization_project = @user.projects.create!(
      organization: organization,
      title: "Class Ruby",
      kind: "ruby",
      visibility: "organization",
      project_files: [ ProjectFile.new(path: "main.rb", language: "ruby", content: "puts 'class'") ]
    )
    unlisted_project = @user.projects.create!(
      organization: organization,
      title: "Link Only Ruby",
      kind: "ruby",
      visibility: "unlisted",
      project_files: [ ProjectFile.new(path: "main.rb", language: "ruby", content: "puts 'link only'") ]
    )
    other_headers = {
      "Authorization" => "Bearer test_token_#{other_student.id}",
      "Content-Type" => "application/json"
    }

    get "/api/v1/organizations/#{organization.id}/projects", headers: other_headers
    assert_response :success
    assert_equal [ organization_project.id ], response.parsed_body.fetch("projects").map { |project| project.fetch("id") }

    get "/api/v1/projects", params: { organization_id: organization.id }, headers: other_headers
    assert_response :success
    assert_equal [ organization_project.id ], response.parsed_body.fetch("projects").map { |project| project.fetch("id") }

    get "/api/v1/projects/#{unlisted_project.id}", headers: other_headers
    assert_response :success
  end

  test "duplicating an unlisted org project outside the org creates a personal copy" do
    outsider = User.create!(
      clerk_id: "test_clerk_outsider",
      email: "outsider@example.com",
      first_name: "Outside",
      last_name: "Student"
    )
    organization = Organization.create!(name: "Source School", created_by: @user)
    organization.organization_memberships.create!(user: @user, role: :owner)
    source_project = @user.projects.create!(
      organization: organization,
      title: "Shareable Ruby",
      kind: "ruby",
      visibility: "unlisted",
      project_files: [ ProjectFile.new(path: "main.rb", language: "ruby", content: "puts 'copy me'") ]
    )
    outsider_headers = {
      "Authorization" => "Bearer test_token_#{outsider.id}",
      "Content-Type" => "application/json"
    }

    post "/api/v1/projects/#{source_project.id}/duplicate", headers: outsider_headers

    assert_response :created
    copy = Project.find(response.parsed_body.dig("project", "id"))
    assert_equal outsider, copy.user
    assert_nil copy.organization_id
    assert_equal source_project, copy.forked_from
  end
end
