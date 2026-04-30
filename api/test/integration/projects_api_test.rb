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
        files: [ { path: "main.rb", language: "ruby", content: "puts 'hafa'" } ]
      }.to_json,
      headers: @headers

    assert_response :created
    project_id = response.parsed_body.dig("project", "id")
    assert_equal "Ruby Playground", response.parsed_body.dig("project", "title")
    assert_equal 1, response.parsed_body.dig("project", "files").length

    get "/api/v1/projects", headers: @headers
    assert_response :success
    assert_equal 1, response.parsed_body.fetch("projects").length

    patch "/api/v1/projects/#{project_id}",
      params: {
        title: "Updated Ruby",
        kind: "ruby",
        files: [ { path: "main.rb", language: "ruby", content: "puts 'updated'" } ]
      }.to_json,
      headers: @headers

    assert_response :success
    assert_equal "Updated Ruby", response.parsed_body.dig("project", "title")
    assert_equal "puts 'updated'", response.parsed_body.dig("project", "files", 0, "content")

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

  test "creates and reads public share snapshots without authentication" do
    post "/api/v1/shares",
      params: {
        title: "Shared Web Page",
        kind: "web",
        files: [
          { path: "index.html", language: "html", content: "<button>Hello</button>" },
          { path: "style.css", language: "css", content: "button { color: red; }" }
        ]
      }.to_json,
      headers: { "Content-Type" => "application/json" }

    assert_response :created
    token = response.parsed_body.dig("share", "token")
    assert_not_empty token
    assert_equal "Shared Web Page", response.parsed_body.dig("share", "snapshot", "title")
    assert_not_nil response.parsed_body.dig("share", "expires_at")

    get "/api/v1/shares/#{token}", headers: { "Content-Type" => "application/json" }

    assert_response :success
    assert_equal "web", response.parsed_body.dig("share", "kind")
    assert_equal 2, response.parsed_body.dig("share", "snapshot", "files").length
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
end
