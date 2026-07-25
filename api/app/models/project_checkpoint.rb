class ProjectCheckpoint < ApplicationRecord
  belongs_to :project

  validates :title, presence: true, length: { maximum: 120 }
  validates :snapshot, presence: true
  validate :snapshot_within_limit

  private

  def snapshot_within_limit
    return if snapshot.to_json.bytesize <= Project::MAX_TOTAL_CONTENT_BYTES + 100_000

    errors.add(:snapshot, "is too large")
  end
end
