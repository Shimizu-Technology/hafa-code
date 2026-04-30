class Project < ApplicationRecord
  KINDS = %w[ruby javascript web].freeze
  VISIBILITIES = %w[private unlisted public].freeze

  belongs_to :user
  belongs_to :forked_from, class_name: "Project", optional: true
  has_many :project_files, -> { order(:position, :id) }, dependent: :destroy, inverse_of: :project

  validates :title, presence: true, length: { maximum: 120 }
  validates :kind, inclusion: { in: KINDS }
  validates :visibility, inclusion: { in: VISIBILITIES }
end
