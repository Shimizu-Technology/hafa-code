class Project < ApplicationRecord
  KINDS = %w[ruby javascript web].freeze
  VISIBILITIES = %w[private unlisted public].freeze

  belongs_to :user
  belongs_to :forked_from, class_name: "Project", optional: true
  has_many :project_files, -> { order(:position, :id) }, dependent: :destroy, inverse_of: :project
  has_many :project_checkpoints, -> { order(created_at: :desc) }, dependent: :destroy

  validates :title, presence: true, length: { maximum: 120 }
  validates :kind, inclusion: { in: KINDS }
  validates :visibility, inclusion: { in: VISIBILITIES }
  validates_associated :project_files
  validate :has_at_least_one_file

  private

  def has_at_least_one_file
    return if project_files.reject(&:marked_for_destruction?).any?

    errors.add(:project_files, "must include at least one file")
  end
end
