module Api
  module V1
    class ProjectsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_accessible_project, only: [ :show, :duplicate ]
      before_action :set_owned_project, only: [ :update, :destroy, :archive, :unarchive ]

      def index
        scope = scoped_projects.order(updated_at: :desc, id: :desc)
        page = positive_integer_param(:page, 1)
        per_page = [ positive_integer_param(:per_page, 50), 100 ].min
        total_count = scope.count
        projects = scope.includes(:project_files, :user, :organization).offset((page - 1) * per_page).limit(per_page)
        render json: {
          projects: projects.map { |project| project_json(project) },
          pagination: {
            page: page,
            per_page: per_page,
            total_count: total_count,
            total_pages: (total_count.to_f / per_page).ceil
          }
        }
      end

      def show
        render json: { project: project_json(@project) }
      end

      def create
        project = current_user.projects.new(project_attrs)
        project.organization = project_organization
        return render_archived_organization_error if project.organization&.archived?
        assign_files(project)

        if project.save
          audit_event!("project.created", organization: project.organization, target: project, metadata: { visibility: project.visibility })
          render json: { project: project_json(project) }, status: :created
        else
          render json: { errors: validation_errors(project) }, status: :unprocessable_entity
        end
      end

      def update
        return render_archived_organization_error if @project.organization&.archived?

        previous_visibility = @project.visibility
        Project.transaction do
          @project.assign_attributes(project_attrs)
          if params.key?(:files)
            @project.project_files.destroy_all
            assign_files(@project)
            @project.updated_at = Time.current
          end
          @project.save!
          if @project.visibility != previous_visibility
            audit_event!(
              "project.visibility_changed",
              organization: @project.organization,
              target: @project,
              metadata: { from: previous_visibility, to: @project.visibility }
            )
          end
        end

        render json: { project: project_json(@project.reload) }
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: validation_errors(e.record) }, status: :unprocessable_entity
      rescue ActiveRecord::StaleObjectError
        current = Project.includes(:project_files, :user, :organization).find(@project.id)
        render json: {
          error: "This project changed in another tab. Reload the latest version before saving again.",
          code: "project_conflict",
          project: project_json(current)
        }, status: :conflict
      end

      def destroy
        return render_archived_organization_error if @project.organization&.archived?

        Project.transaction do
          audit_event!("project.deleted", organization: @project.organization, target: @project, metadata: { visibility: @project.visibility })
          @project.destroy!
        end
        head :no_content
      end

      def archive
        return render_archived_organization_error if @project.organization&.archived?

        @project.update!(archived_at: Time.current)
        render json: { project: project_json(@project.reload) }
      end

      def unarchive
        return render_archived_organization_error if @project.organization&.archived?

        @project.update!(archived_at: nil)
        render json: { project: project_json(@project.reload) }
      end

      def duplicate
        return render_archived_organization_error if @project.organization&.archived?

        copy = current_user.projects.new(
          title: "#{@project.title} Copy",
          kind: @project.kind,
          entry_path: @project.entry_path,
          visibility: "private",
          organization: duplicate_organization,
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
          audit_event!(
            "project.duplicated",
            organization: copy.organization,
            target: copy,
            metadata: { source_project_id: @project.id }
          )
          render json: { project: project_json(copy) }, status: :created
        else
          render json: { errors: copy.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def scoped_projects
        if params[:organization_id].present?
          organization = organization_scope.find(params[:organization_id])
          return Project.where(organization: organization) if current_user.admin?

          return Project.where(organization: organization)
            .where("user_id = :user_id OR visibility IN (:member_visibilities) OR EXISTS (
              SELECT 1 FROM organization_memberships
              WHERE organization_memberships.organization_id = projects.organization_id
              AND organization_memberships.user_id = :user_id
              AND organization_memberships.role IN (:instructor_roles)
            )", user_id: current_user.id, member_visibilities: %w[organization public], instructor_roles: [ OrganizationMembership.roles[:instructor], OrganizationMembership.roles[:owner] ])
        end

        current_user.projects.where(organization_id: nil)
      end

      def set_accessible_project
        @project = Project.includes(:project_files, :user, :organization).find(params[:id])
        render_forbidden unless can_view_project?(current_user, @project)
        if current_user.admin? && @project.user_id != current_user.id && @project.visibility == "private"
          audit_event!("project.private_viewed_by_admin", organization: @project.organization, target: @project)
        end
      end

      def set_owned_project
        @project = current_user.projects.includes(:project_files, :user, :organization).find(params[:id])
      end

      def project_attrs
        params.permit(:title, :kind, :visibility, :entry_path, :lock_version)
      end

      def project_organization
        return nil if params[:organization_id].blank?

        organization_scope.find(params[:organization_id])
      end

      def duplicate_organization
        return nil unless @project.organization

        current_user.organizations.find_by(id: @project.organization_id)
      end

      def organization_scope
        current_user.admin? ? Organization.all : current_user.organizations
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

      def render_archived_organization_error
        render json: { errors: [ "This classroom is archived and read-only" ] }, status: :unprocessable_entity
      end

      def positive_integer_param(name, default)
        value = Integer(params[name], exception: false)
        value&.positive? ? value : default
      end
    end
  end
end
