module Api
  module V1
    class ProjectCheckpointsController < ApplicationController
      MAX_CHECKPOINTS_PER_PROJECT = 30
      MAX_FILES_PER_CHECKPOINT = 12
      MAX_FILE_BYTES = 500_000

      before_action :authenticate_user!
      before_action :set_project
      before_action :set_checkpoint, only: [ :restore ]

      def index
        checkpoints = @project.project_checkpoints
          .reorder(created_at: :desc, id: :desc)
          .limit(MAX_CHECKPOINTS_PER_PROJECT)

        render json: { checkpoints: checkpoints.map { |checkpoint| checkpoint_json(checkpoint, include_snapshot: false) } }
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
      rescue ArgumentError => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
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
        @project = current_user.projects.includes(:project_files).find(params[:project_id])
      end

      def set_checkpoint
        @checkpoint = @project.project_checkpoints.find(params[:id])
      end

      def prune_old_checkpoints(saved_checkpoint)
        checkpoint_ids = @project.project_checkpoints
          .where.not(id: saved_checkpoint.id)
          .reorder(created_at: :desc, id: :desc)
          .offset(MAX_CHECKPOINTS_PER_PROJECT - 1)
          .pluck(:id)

        @project.project_checkpoints.where(id: checkpoint_ids).destroy_all
      end

      def project_snapshot(project)
        raise ArgumentError, "Too many files for checkpoint" if project.project_files.length > MAX_FILES_PER_CHECKPOINT

        {
          title: project.title,
          kind: project.kind,
          files: project.project_files.map.with_index do |file, index|
            raise ArgumentError, "File content is too large for checkpoint" if file.content.to_s.bytesize > MAX_FILE_BYTES

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
    end
  end
end
