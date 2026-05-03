class Project < ApplicationRecord
  KINDS = %w[ruby javascript web].freeze
  VISIBILITIES = %w[private unlisted public].freeze
  MAX_FILES = 50

  belongs_to :user
  belongs_to :forked_from, class_name: "Project", optional: true
  has_many :project_files, -> { order(:position, :id) }, dependent: :destroy, inverse_of: :project
  has_many :project_checkpoints, -> { order(created_at: :desc) }, dependent: :destroy

  validates :title, presence: true, length: { maximum: 120 }
  validates :kind, inclusion: { in: KINDS }
  validates :visibility, inclusion: { in: VISIBILITIES }
  validates :entry_path, length: { maximum: 160 }, allow_blank: true
  validates_associated :project_files
  validate :file_count_within_limit
  validate :has_at_least_one_file
  validate :entry_path_matches_file

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

  def entry_path_matches_file
    return if entry_path.blank?
    return if project_files.reject(&:marked_for_destruction?).any? { |file| file.path == entry_path }

    errors.add(:entry_path, "must match a project file")
  end
end
