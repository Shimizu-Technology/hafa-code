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
end
