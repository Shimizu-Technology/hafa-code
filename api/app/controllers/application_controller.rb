class ApplicationController < ActionController::API
  include ClerkAuthenticatable
  include Authorizable

  rescue_from ActiveRecord::RecordNotFound, with: :render_not_found

  private

  def render_not_found
    render json: { error: "Not found" }, status: :not_found
  end

  def project_json(project)
    {
      id: project.id,
      title: project.title,
      kind: project.kind,
      entry_path: project.entry_path,
      visibility: project.visibility,
      organization_id: project.organization_id,
      forked_from_id: project.forked_from_id,
      owner: project.user && {
        id: project.user.id,
        full_name: project.user.full_name
      },
      organization: project.organization && {
        id: project.organization.id,
        name: project.organization.name,
        slug: project.organization.slug
      },
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
