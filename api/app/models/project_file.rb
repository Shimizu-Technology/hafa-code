class ProjectFile < ApplicationRecord
  LANGUAGES = %w[ruby javascript html css json plain].freeze
  RESERVED_SEGMENTS = %w[. ..].freeze

  belongs_to :project

  validates :path, presence: true, length: { maximum: 160 }, uniqueness: { scope: :project_id }
  validates :language, inclusion: { in: LANGUAGES }
  validates :content, length: { maximum: 500_000 }
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate :path_is_safe_relative_path

  private

  def path_is_safe_relative_path
    return if path.blank?

    normalized_path = path.to_s.tr("\\", "/").strip
    if normalized_path != path
      errors.add(:path, "must use normalized / separators")
      return
    end

    if normalized_path.start_with?("/") || normalized_path.end_with?("/")
      errors.add(:path, "must be a relative file path")
      return
    end

    segments = normalized_path.split("/")
    if segments.any?(&:blank?) || segments.any? { |segment| RESERVED_SEGMENTS.include?(segment) }
      errors.add(:path, "cannot include empty, current, or parent directory segments")
    end

    if segments.any? { |segment| segment.start_with?(".") }
      errors.add(:path, "cannot include hidden files or folders yet")
    end
  end
end
