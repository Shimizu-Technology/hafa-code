module Api
  module V1
    class ProjectCheckpointsController < ApplicationController
      MAX_CHECKPOINTS_PER_PROJECT = 30

      before_action :authenticate_user!
      before_action :set_project
      before_action :set_checkpoint, only: [ :restore ]

      def index
        render json: { checkpoints: @project.project_checkpoints.limit(MAX_CHECKPOINTS_PER_PROJECT).map { |checkpoint| checkpoint_json(checkpoint, include_snapshot: false) } }
      end

      def create
        checkpoint = @project.project_checkpoints.new(
          title: params[:title].presence || "Checkpoint",
          snapshot: project_snapshot(@project)
        )

        if checkpoint.save
          prune_old_checkpoints(checkpoint)
          render json: { checkpoint: checkpoint_json(checkpoint) }, status: :created
        else
          render json: { errors: checkpoint.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def restore
        snapshot = @checkpoint.snapshot

        Project.transaction do
          @project.update!(
            title: snapshot.fetch("title", @project.title),
            kind: snapshot.fetch("kind", @project.kind)
          )
          @project.project_files.destroy_all
          Array(snapshot["files"]).each_with_index do |file, index|
            next unless file.is_a?(Hash)

            @project.project_files.build(
              path: file["path"],
              language: file["language"],
              content: file["content"].to_s,
              position: file["position"] || index
            )
          end
          @project.save!
        end

        render json: { project: project_json(@project.reload), checkpoint: checkpoint_json(@checkpoint) }
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      private

      def set_project
        @project = current_user.projects.includes(:project_files, :project_checkpoints).find(params[:project_id])
      end

      def set_checkpoint
        @checkpoint = @project.project_checkpoints.find(params[:id])
      end

      def prune_old_checkpoints(saved_checkpoint)
        checkpoint_ids = @project.project_checkpoints
          .where.not(id: saved_checkpoint.id)
          .offset(MAX_CHECKPOINTS_PER_PROJECT - 1)
          .pluck(:id)

        @project.project_checkpoints.where(id: checkpoint_ids).destroy_all
      end

      def project_snapshot(project)
        {
          title: project.title,
          kind: project.kind,
          files: project.project_files.map.with_index do |file, index|
            {
              path: file.path,
              language: file.language,
              content: file.content,
              position: index
            }
          end
        }
      end

      def checkpoint_json(checkpoint, include_snapshot: true)
        payload = {
          id: checkpoint.id,
          title: checkpoint.title,
          created_at: checkpoint.created_at
        }
        payload[:snapshot] = checkpoint.snapshot if include_snapshot
        payload
      end

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
  end
end
