class ProjectFile < ApplicationRecord
  LANGUAGES = %w[ruby javascript html css].freeze

  belongs_to :project

  validates :path, presence: true, length: { maximum: 160 }, uniqueness: { scope: :project_id }
  validates :language, inclusion: { in: LANGUAGES }
  validates :content, length: { maximum: 500_000 }
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
end
