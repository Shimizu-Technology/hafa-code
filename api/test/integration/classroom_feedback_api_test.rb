require "test_helper"

class ClassroomFeedbackApiTest < ActionDispatch::IntegrationTest
  setup do
    @teacher = create_user("teacher", "teacher@example.com")
    @student = create_user("student", "student@example.com")
    @classmate = create_user("classmate", "classmate@example.com")
    @organization = Organization.create!(name: "FDMS Period 1", created_by: @teacher)
    @organization.organization_memberships.create!(user: @teacher, role: :owner)
    @organization.organization_memberships.create!(user: @student, role: :student)
    @organization.organization_memberships.create!(user: @classmate, role: :student)
    @project = @student.projects.create!(
      organization: @organization,
      title: "Private Ruby",
      kind: "ruby",
      visibility: "private",
      project_files: [
        ProjectFile.new(path: "main.rb", language: "ruby", content: "puts 'hafa'")
      ]
    )
  end

  test "teacher and project owner can discuss private work" do
    post "/api/v1/projects/#{@project.id}/comments",
      params: { body: "Explain why this loop stops.", file_path: "main.rb", line_number: 1 }.to_json,
      headers: headers_for(@teacher)

    assert_response :created
    comment_id = response.parsed_body.dig("comment", "id")
    assert_equal "owner", response.parsed_body.dig("comment", "author", "role")
    assert_equal "main.rb", response.parsed_body.dig("comment", "file_path")

    get "/api/v1/projects/#{@project.id}/comments", headers: headers_for(@student)

    assert_response :success
    assert_equal 1, response.parsed_body.fetch("unread_count")
    assert_equal "Explain why this loop stops.", response.parsed_body.dig("comments", 0, "body")

    post "/api/v1/projects/#{@project.id}/comments",
      params: { body: "It stops after the collection is exhausted." }.to_json,
      headers: headers_for(@student)

    assert_response :created

    patch "/api/v1/projects/#{@project.id}/comments/#{comment_id}/resolve",
      params: { resolved: true }.to_json,
      headers: headers_for(@student)

    assert_response :success
    assert_not_nil response.parsed_body.dig("comment", "resolved_at")
    assert_equal @student.id, response.parsed_body.dig("comment", "resolved_by", "id")
  end

  test "classmates cannot read feedback even when they belong to the organization" do
    @project.project_comments.create!(user: @teacher, body: "Private teacher note")

    get "/api/v1/projects/#{@project.id}/comments", headers: headers_for(@classmate)

    assert_response :forbidden
    assert_equal "Feedback is private to the project owner and teaching staff.", response.parsed_body.fetch("error")
  end

  test "marking feedback read resets unread count" do
    @project.project_comments.create!(user: @teacher, body: "Please add one test.")

    get "/api/v1/projects/#{@project.id}/comments", headers: headers_for(@student)
    assert_equal 1, response.parsed_body.fetch("unread_count")

    post "/api/v1/projects/#{@project.id}/comments/mark_read", headers: headers_for(@student)
    assert_response :no_content

    get "/api/v1/projects/#{@project.id}/comments", headers: headers_for(@student)
    assert_response :success
    assert_equal 0, response.parsed_body.fetch("unread_count")
  end

  test "feedback file and line references must be valid" do
    post "/api/v1/projects/#{@project.id}/comments",
      params: { body: "Look here", file_path: "missing.rb", line_number: 4 }.to_json,
      headers: headers_for(@teacher)

    assert_response :unprocessable_entity
    assert_includes response.parsed_body.fetch("errors"), "File path must match a project file"

    post "/api/v1/projects/#{@project.id}/comments",
      params: { body: "Look here", line_number: 4 }.to_json,
      headers: headers_for(@teacher)

    assert_response :unprocessable_entity
    assert_includes response.parsed_body.fetch("errors"), "Line number requires a file path"
  end

  test "feedback can be resolved after its referenced file is removed" do
    @project.project_files.create!(
      path: "other.rb",
      language: "ruby",
      content: "puts 'other'",
      position: 1
    )
    comment = @project.project_comments.create!(
      user: @teacher,
      body: "This file can be removed later.",
      file_path: "main.rb",
      line_number: 1
    )
    @project.project_files.find_by!(path: "main.rb").destroy!

    patch "/api/v1/projects/#{@project.id}/comments/#{comment.id}/resolve",
      params: { resolved: true }.to_json,
      headers: headers_for(@student)

    assert_response :success
    assert_not_nil comment.reload.resolved_at
  end

  private

  def create_user(key, email)
    User.create!(
      clerk_id: "test_clerk_#{key}",
      email: email,
      first_name: key.capitalize,
      last_name: "User"
    )
  end

  def headers_for(user)
    {
      "Authorization" => "Bearer test_token_#{user.id}",
      "Content-Type" => "application/json"
    }
  end
end
