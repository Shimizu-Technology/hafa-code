module Api
  module V1
    class ProjectsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_accessible_project, only: [ :show, :duplicate ]
      before_action :set_owned_project, only: [ :update, :destroy, :archive, :unarchive ]

      def index
        projects = scoped_projects.includes(:project_files, :user, :organization).order(updated_at: :desc)
        render json: { projects: projects.map { |project| project_json(project) } }
      end

      def show
        render json: { project: project_json(@project) }
      end

      def create
        project = current_user.projects.new(project_attrs)
        project.organization = project_organization
        assign_files(project)

        if project.save
          render json: { project: project_json(project) }, status: :created
        else
          render json: { errors: validation_errors(project) }, status: :unprocessable_entity
        end
      end

      def update
        Project.transaction do
          @project.assign_attributes(project_attrs)
          if params.key?(:files)
            @project.project_files.destroy_all
            assign_files(@project)
          end
          @project.save!
        end

        render json: { project: project_json(@project.reload) }
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: validation_errors(e.record) }, status: :unprocessable_entity
      end

      def destroy
        @project.destroy
        head :no_content
      end

      def archive
        @project.update!(archived_at: Time.current)
        render json: { project: project_json(@project.reload) }
      end

      def unarchive
        @project.update!(archived_at: nil)
        render json: { project: project_json(@project.reload) }
      end

      def duplicate
        copy = current_user.projects.new(
          title: "#{@project.title} Copy",
          kind: @project.kind,
          entry_path: @project.entry_path,
          visibility: "private",
          organization: @project.organization,
          forked_from: @project
        )
        @project.project_files.each_with_index do |file, index|
          copy.project_files.build(
            path: file.path,
            language: file.language,
            content: file.content,
            position: index
          )
        end

        if copy.save
          render json: { project: project_json(copy) }, status: :created
        else
          render json: { errors: copy.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def scoped_projects
        if params[:organization_id].present?
          organization = current_user.organizations.find(params[:organization_id])
          return Project.where(organization: organization)
            .where("user_id = :user_id OR visibility IN (:member_visibilities) OR EXISTS (
              SELECT 1 FROM organization_memberships
              WHERE organization_memberships.organization_id = projects.organization_id
              AND organization_memberships.user_id = :user_id
              AND organization_memberships.role IN (:instructor_roles)
            )", user_id: current_user.id, member_visibilities: %w[organization unlisted public], instructor_roles: [ OrganizationMembership.roles[:instructor], OrganizationMembership.roles[:owner] ])
        end

        current_user.projects.where(organization_id: nil)
      end

      def set_accessible_project
        @project = Project.includes(:project_files, :user, :organization).find(params[:id])
        render_forbidden unless can_view_project?(current_user, @project)
      end

      def set_owned_project
        @project = current_user.projects.includes(:project_files, :user, :organization).find(params[:id])
      end

      def project_attrs
        params.permit(:title, :kind, :visibility, :entry_path)
      end

      def project_organization
        return nil if params[:organization_id].blank?

        current_user.organizations.find(params[:organization_id])
      end

      def files_param
        return [] unless params[:files].is_a?(Array)

        params[:files]
      end

      def assign_files(project)
        files_param.each_with_index do |file, index|
          next unless file.respond_to?(:to_unsafe_h)

          permitted = ActionController::Parameters.new(file.to_unsafe_h).permit(:path, :language, :content, :position)
          project.project_files.build(
            path: permitted[:path].to_s.strip,
            language: permitted[:language],
            content: permitted[:content].to_s,
            position: permitted[:position] || index
          )
        end
      end

      def validation_errors(project)
        file_errors = project.project_files.flat_map.with_index do |file, index|
          file.errors.full_messages.map { |message| "File #{index + 1}: #{message}" }
        end

        (project.errors.full_messages + file_errors).uniq
      end
    end
  end
end
