class OrganizationInvitation < ApplicationRecord
  TOKEN_BYTES = 18

  enum :role, { student: 0, instructor: 1 }

  belongs_to :organization
  belongs_to :invited_by, class_name: "User"

  validates :email, presence: true, length: { maximum: 255 },
    format: { with: URI::MailTo::EMAIL_REGEXP, message: "is invalid" }
  validates :role, presence: true
  validates :token, presence: true, uniqueness: true

  before_validation :normalize_email
  before_validation :ensure_token
  before_validation :set_default_expiration

  scope :pending, -> { where(accepted_at: nil).where("expires_at IS NULL OR expires_at > ?", Time.current) }

  def accepted?
    accepted_at.present?
  end

  def expired?
    expires_at.present? && expires_at <= Time.current
  end

  private

  def normalize_email
    self.email = email.to_s.strip.downcase
  end

  def ensure_token
    return if token.present?

    self.token = loop do
      candidate = SecureRandom.urlsafe_base64(TOKEN_BYTES)
      break candidate unless self.class.exists?(token: candidate)
    end
  end

  def set_default_expiration
    self.expires_at ||= 14.days.from_now
  end
end
