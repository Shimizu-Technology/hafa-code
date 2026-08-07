class Project < ApplicationRecord
  KINDS = %w[ruby javascript python web].freeze
  VISIBILITIES = %w[private organization unlisted public].freeze
  MAX_FILES = 50
  MAX_TOTAL_CONTENT_BYTES = 2_000_000

  belongs_to :user
  belongs_to :organization, optional: true
  belongs_to :forked_from, class_name: "Project", optional: true
  has_many :project_files, -> { order(:position, :id) }, dependent: :destroy, inverse_of: :project
  has_many :project_checkpoints, -> { order(created_at: :desc) }, dependent: :destroy
  has_many :project_comments, dependent: :destroy
  has_many :project_comment_reads, dependent: :destroy

  validates :title, presence: true, length: { maximum: 120 }
  validates :kind, inclusion: { in: KINDS }
  validates :visibility, inclusion: { in: VISIBILITIES }
  validates :entry_path, length: { maximum: 160 }, allow_blank: true
  validates_associated :project_files
  validate :file_count_within_limit
  validate :has_at_least_one_file
  validate :total_content_within_limit
  validate :entry_path_matches_file
  validate :organization_visibility_requires_organization
  validate :organization_external_sharing_requires_policy

  before_validation :set_default_entry_path

  private

  def set_default_entry_path
    files = project_files.reject(&:marked_for_destruction?)
    return if files.empty?
    return if entry_path.present?

    self.entry_path = default_entry_path(files)
  end

  def default_entry_path(files)
    preferred_paths =
      case kind
      when "web" then %w[index.html main.html]
      when "ruby" then %w[main.rb]
      when "python" then %w[main.py app.py]
      else %w[main.js index.js]
      end

    preferred_paths.each do |path|
      match = files.find { |file| file.path == path }
      return match.path if match
    end

    preferred_language = kind == "web" ? "html" : kind
    files.find { |file| file.language == preferred_language }&.path || files.first&.path
  end

  def file_count_within_limit
    return if project_files.reject(&:marked_for_destruction?).length <= MAX_FILES

    errors.add(:project_files, "cannot include more than #{MAX_FILES} files")
  end

  def has_at_least_one_file
    return if project_files.reject(&:marked_for_destruction?).any?

    errors.add(:project_files, "must include at least one file")
  end

  def total_content_within_limit
    total_bytes = project_files.reject(&:marked_for_destruction?).sum { |file| file.content.to_s.bytesize }
    return if total_bytes <= MAX_TOTAL_CONTENT_BYTES

    errors.add(:project_files, "cannot contain more than #{MAX_TOTAL_CONTENT_BYTES / 1_000_000} MB of source code")
  end

  def entry_path_matches_file
    return if entry_path.blank?
    return if project_files.reject(&:marked_for_destruction?).any? { |file| file.path == entry_path }

    errors.add(:entry_path, "must match a project file")
  end

  def organization_visibility_requires_organization
    return unless visibility == "organization"
    return if organization_id.present?

    errors.add(:organization, "must be present for organization visibility")
  end

  def organization_external_sharing_requires_policy
    return unless organization_id.present? && visibility.in?(%w[unlisted public])
    return unless new_record? || will_save_change_to_visibility?
    return if ActiveModel::Type::Boolean.new.cast(ENV["ALLOW_ORGANIZATION_EXTERNAL_SHARING"])

    errors.add(:visibility, "must stay teacher-only or class-visible for this organization")
  end
end
