module Api
  module V1
    class ProjectCommentsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_project
      before_action :authorize_feedback!
      before_action :set_comment, only: [ :resolve ]

      def index
        comments = @project.project_comments.includes(:user, :resolved_by).order(:created_at, :id)
        unread_count = comments.count do |comment|
          comment.user_id != current_user.id && comment.created_at > last_read_at
        end

        render json: {
          comments: comments.map { |comment| comment_json(comment) },
          unread_count: unread_count
        }
      end

      def create
        comment = @project.project_comments.new(comment_params.merge(user: current_user))

        if comment.save
          mark_read!
          audit_event!(
            "project.feedback.created",
            organization: @project.organization,
            target: comment,
            metadata: { project_id: @project.id, file_path: comment.file_path, line_number: comment.line_number }
          )
          render json: { comment: comment_json(comment) }, status: :created
        else
          render json: { errors: comment.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def resolve
        resolved = ActiveModel::Type::Boolean.new.cast(params.fetch(:resolved, true))
        @comment.update!(
          resolved_at: resolved ? Time.current : nil,
          resolved_by: resolved ? current_user : nil
        )
        audit_event!(
          resolved ? "project.feedback.resolved" : "project.feedback.reopened",
          organization: @project.organization,
          target: @comment,
          metadata: { project_id: @project.id }
        )

        render json: { comment: comment_json(@comment.reload) }
      end

      def mark_read
        mark_read!
        head :no_content
      end

      private

      def set_project
        @project = Project.includes(:project_files, :organization, :user).find(params[:project_id])
      end

      def authorize_feedback!
        render_forbidden("Feedback is private to the project owner and teaching staff.") unless can_access_project_feedback?(current_user, @project)
      end

      def set_comment
        @comment = @project.project_comments.find(params[:id])
      end

      def comment_params
        params.permit(:body, :file_path, :line_number)
      end

      def mark_read!
        read = @project.project_comment_reads.find_or_initialize_by(user: current_user)
        read.update!(read_at: Time.current)
      end

      def last_read_at
        @last_read_at ||= @project.project_comment_reads.find_by(user: current_user)&.read_at || Time.at(0)
      end

      def comment_json(comment)
        {
          id: comment.id,
          body: comment.body,
          file_path: comment.file_path,
          line_number: comment.line_number,
          resolved_at: comment.resolved_at,
          edited_at: comment.edited_at,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          author: {
            id: comment.user.id,
            full_name: comment.user.full_name,
            role: comment_author_role(comment.user)
          },
          resolved_by: comment.resolved_by && {
            id: comment.resolved_by.id,
            full_name: comment.resolved_by.full_name
          }
        }
      end

      def comment_author_role(user)
        return "admin" if user.admin?
        return "owner" if @project.organization && organization_membership_for(user, @project.organization)&.owner?
        return "instructor" if @project.organization && organization_membership_for(user, @project.organization)&.instructor?

        "student"
      end
    end
  end
end
