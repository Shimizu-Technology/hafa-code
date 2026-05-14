require "securerandom"

class Organization < ApplicationRecord
  SLUG_RANDOM_SUFFIX_LENGTH = 6

  belongs_to :created_by, class_name: "User"
  has_many :organization_memberships, dependent: :destroy
  has_many :members, through: :organization_memberships, source: :user
  has_many :organization_invitations, dependent: :destroy
  has_many :projects, dependent: :nullify

  before_destroy :privatize_organization_visible_projects, prepend: true
  validates :name, presence: true, length: { maximum: 120 }
  validates :slug, presence: true, uniqueness: true, length: { maximum: 80 },
    format: { with: /\A[a-z0-9]+(?:-[a-z0-9]+)*\z/ }

  before_validation :set_slug

  private

  def privatize_organization_visible_projects
    projects.where(visibility: "organization").update_all(visibility: "private", updated_at: Time.current)
  end

  def set_slug
    return if slug.present?

    base = name.to_s.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-|-+\z/, "").presence || "organization"
    self.slug = if self.class.where(slug: base).exists?
      random_slug_for(base)
    else
      base
    end
  end

  def random_slug_for(base)
    loop do
      suffix = SecureRandom.alphanumeric(SLUG_RANDOM_SUFFIX_LENGTH).downcase
      candidate = [ base, suffix ].join("-").first(80).gsub(/-+\z/, "")
      return candidate unless self.class.where(slug: candidate).exists?
    end
  end
end
