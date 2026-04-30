module Api
  module V1
    class ProjectSharesController < ApplicationController
      MAX_FILES = 12
      MAX_FILE_BYTES = 500_000
      SHARE_TTL = 30.days

      def create
        return render_rate_limited if share_rate_limited?

        snapshot = normalized_snapshot
        attempts = 0

        begin
          share = ProjectShare.new(
            title: snapshot.fetch(:title),
            kind: snapshot.fetch(:kind),
            snapshot: snapshot,
            expires_at: SHARE_TTL.from_now
          )

          if share.save
            render json: { share: share_json(share) }, status: :created
          else
            render json: { errors: share.errors.full_messages }, status: :unprocessable_entity
          end
        rescue ActiveRecord::RecordNotUnique
          attempts += 1
          retry if attempts < 3

          render json: { errors: [ "Could not create a unique share link" ] }, status: :unprocessable_entity
        end
      rescue ActionController::ParameterMissing, ArgumentError => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      end

      def show
        share = ProjectShare
          .where("expires_at IS NULL OR expires_at > ?", Time.current)
          .find_by!(token: params[:token])
        render json: { share: share_json(share) }
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Share not found" }, status: :not_found
      end

      private

      def share_rate_limited?
        key = "share-create:#{request.remote_ip}"
        count = Rails.cache.read(key).to_i + 1
        Rails.cache.write(key, count, expires_in: 1.hour)
        count > 60
      end

      def render_rate_limited
        render json: { error: "Too many share links created. Please try again later." }, status: :too_many_requests
      end

      def normalized_snapshot
        title = params.require(:title).to_s.strip
        kind = params.require(:kind).to_s
        files = params.require(:files)
        raise ArgumentError, "Title is required" if title.blank?
        raise ArgumentError, "Unsupported project type" unless Project::KINDS.include?(kind)
        raise ArgumentError, "At least one file is required" unless files.is_a?(Array) && files.any?
        raise ArgumentError, "Too many files" if files.length > MAX_FILES

        normalized_files = files.each_with_index.filter_map do |file, index|
          next unless file.respond_to?(:to_unsafe_h)

          permitted = ActionController::Parameters.new(file.to_unsafe_h).permit(:path, :language, :content, :position)
          path = permitted[:path].to_s.strip
          language = permitted[:language].to_s
          content = permitted[:content].to_s
          next if path.blank?
          raise ArgumentError, "Unsupported file language" unless ProjectFile::LANGUAGES.include?(language)
          raise ArgumentError, "File content is too large" if content.bytesize > MAX_FILE_BYTES

          {
            path: path,
            language: language,
            content: content,
            position: permitted[:position] || index
          }
        end

        raise ArgumentError, "At least one valid file is required" if normalized_files.empty?

        {
          title: title,
          kind: kind,
          files: normalized_files
        }
      end

      def share_json(share)
        {
          token: share.token,
          title: share.title,
          kind: share.kind,
          created_at: share.created_at,
          expires_at: share.expires_at,
          snapshot: share.snapshot
        }
      end
    end
  end
end
