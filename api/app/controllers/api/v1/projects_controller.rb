module Api
  module V1
    class ProjectsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_project, only: [ :show, :update, :destroy, :duplicate ]

      def index
        projects = current_user.projects.includes(:project_files).order(updated_at: :desc)
        render json: { projects: projects.map { |project| project_json(project) } }
      end

      def show
        render json: { project: project_json(@project) }
      end

      def create
        project = current_user.projects.new(project_attrs)
        assign_files(project)

        if project.save
          render json: { project: project_json(project) }, status: :created
        else
          render json: { errors: project.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def update
        Project.transaction do
          @project.update!(project_attrs)
          if params.key?(:files)
            @project.project_files.destroy_all
            assign_files(@project)
            @project.save!
          end
        end

        render json: { project: project_json(@project.reload) }
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def destroy
        @project.destroy
        head :no_content
      end

      def duplicate
        copy = current_user.projects.new(
          title: "#{@project.title} Copy",
          kind: @project.kind,
          visibility: "private",
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

      def set_project
        @project = current_user.projects.includes(:project_files).find(params[:id])
      end

      def project_attrs
        params.permit(:title, :kind, :visibility)
      end

      def files_param
        return [] unless params[:files].is_a?(Array)

        params[:files]
      end

      def assign_files(project)
        files_param.each_with_index do |file, index|
          permitted = ActionController::Parameters.new(file.to_unsafe_h).permit(:path, :language, :content, :position)
          project.project_files.build(
            path: permitted[:path],
            language: permitted[:language],
            content: permitted[:content].to_s,
            position: permitted[:position] || index
          )
        end
      end

      def project_json(project)
        {
          id: project.id,
          title: project.title,
          kind: project.kind,
          visibility: project.visibility,
          forked_from_id: project.forked_from_id,
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
  end
end
