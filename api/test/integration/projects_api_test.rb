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
end
