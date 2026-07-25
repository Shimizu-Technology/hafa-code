class ProjectShare < ApplicationRecord
  KINDS = Project::KINDS
  TOKEN_BYTES = 18

  validates :token, presence: true, uniqueness: true
  validates :title, presence: true, length: { maximum: 120 }
  validates :kind, inclusion: { in: KINDS }
  validates :snapshot, presence: true
  validate :snapshot_within_limit

  before_validation :ensure_token

  private

  def ensure_token
    return if token.present?

    self.token = loop do
      candidate = SecureRandom.urlsafe_base64(TOKEN_BYTES)
      break candidate unless self.class.exists?(token: candidate)
    end
  end

  def snapshot_within_limit
    return if snapshot.to_json.bytesize <= Project::MAX_TOTAL_CONTENT_BYTES + 100_000

    errors.add(:snapshot, "is too large")
  end
end
