class ApplicationController < ActionController::API
  include ClerkAuthenticatable

  private

  def project_json(project)
    {
      id: project.id,
      title: project.title,
      kind: project.kind,
      visibility: project.visibility,
      forked_from_id: project.forked_from_id,
      archived_at: project.archived_at,
      created_at: project.created_at,
      updated_at: project.updated_at,
      files: project.project_files.map do |file|
        {
          id: file.id,
          path: file.path,
          language: file.language,
          content: file.content,
          position: file.position
        }
      end
    }
  end
end
