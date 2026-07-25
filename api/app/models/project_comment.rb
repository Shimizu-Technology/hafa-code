class ProjectComment < ApplicationRecord
  MAX_BODY_LENGTH = 10_000

  belongs_to :project
  belongs_to :user
  belongs_to :resolved_by, class_name: "User", optional: true

  validates :body, presence: true, length: { maximum: MAX_BODY_LENGTH }
  validates :file_path, length: { maximum: 160 }, allow_blank: true
  validates :line_number, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validate :file_path_belongs_to_project
  validate :line_number_requires_file_path

  def resolved?
    resolved_at.present?
  end

  private

  def file_path_belongs_to_project
    return if file_path.blank? || !project
    return if project.project_files.any? { |file| file.path == file_path }

    errors.add(:file_path, "must match a project file")
  end

  def line_number_requires_file_path
    return if line_number.blank? || file_path.present?

    errors.add(:line_number, "requires a file path")
  end
end
