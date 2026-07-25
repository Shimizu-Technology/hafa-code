require "test_helper"

class ProjectQuotaTest < ActiveSupport::TestCase
  test "rejects a project whose combined source exceeds the classroom limit" do
    user = User.create!(
      clerk_id: "quota-student",
      email: "quota-student@example.com",
      first_name: "Quota",
      last_name: "Student"
    )
    project = user.projects.new(title: "Oversized Project", kind: "ruby", visibility: "private")
    5.times do |index|
      project.project_files.build(
        path: "file#{index}.rb",
        language: "ruby",
        content: "a" * 450_000,
        position: index
      )
    end

    assert_not project.valid?
    assert_includes project.errors.full_messages, "Project files cannot contain more than 2 MB of source code"
  end

  test "counts multibyte content by bytes as well as characters" do
    file = ProjectFile.new(path: "main.rb", language: "ruby", content: "å" * 300_000, position: 0)

    assert_not file.valid?
    assert_includes file.errors.full_messages, "Content is too large (maximum is 500 KB)"
  end
end
