class BackfillProjectFilesForLegacyProjects < ActiveRecord::Migration[8.1]
  class MigrationProject < ActiveRecord::Base
    self.table_name = "projects"
    has_many :project_files, class_name: "BackfillProjectFilesForLegacyProjects::MigrationProjectFile", foreign_key: :project_id
  end

  class MigrationProjectFile < ActiveRecord::Base
    self.table_name = "project_files"
    belongs_to :project, class_name: "BackfillProjectFilesForLegacyProjects::MigrationProject"
  end

  DEFAULT_FILES = {
    "ruby" => [ "main.rb", "ruby", "puts \"Hafa adai, Ruby!\"\n" ],
    "javascript" => [ "main.js", "javascript", "console.log(\"Hafa adai, JavaScript!\")\n" ],
    "web" => [ "index.html", "html", "<main>\n  <h1>Hafa adai!</h1>\n  <p>Start building your web page.</p>\n</main>\n" ]
  }.freeze

  def up
    MigrationProject.left_joins(:project_files).where(project_files: { id: nil }).find_each do |project|
      path, language, content = DEFAULT_FILES.fetch(project.kind) { DEFAULT_FILES.fetch("javascript") }
      MigrationProjectFile.create!(
        project_id: project.id,
        path: path,
        language: language,
        content: content,
        position: 0,
        created_at: Time.current,
        updated_at: Time.current
      )
    end
  end

  def down
    # Data backfill only. Do not delete user project files on rollback.
  end
end
