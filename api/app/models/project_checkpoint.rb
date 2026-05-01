class ProjectCheckpoint < ApplicationRecord
  belongs_to :project

  validates :title, presence: true, length: { maximum: 120 }
  validates :snapshot, presence: true
end
