class Organization < ApplicationRecord
  belongs_to :created_by, class_name: "User"
  has_many :organization_memberships, dependent: :destroy
  has_many :members, through: :organization_memberships, source: :user
  has_many :organization_invitations, dependent: :destroy
  has_many :projects, dependent: :nullify

  validates :name, presence: true, length: { maximum: 120 }
  validates :slug, presence: true, uniqueness: true, length: { maximum: 80 },
    format: { with: /\A[a-z0-9]+(?:-[a-z0-9]+)*\z/ }

  before_validation :set_slug

  private

  def set_slug
    return if slug.present?

    base = name.to_s.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-|-+\z/, "").presence || "organization"
    candidate = base
    suffix = 2
    while self.class.exists?(slug: candidate)
      candidate = "#{base}-#{suffix}"
      suffix += 1
    end
    self.slug = candidate
  end
end
