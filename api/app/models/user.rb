class User < ApplicationRecord
  enum :role, { student: 0, mentor: 1, admin: 2 }

  has_many :projects, dependent: :destroy
  has_many :organization_memberships, dependent: :destroy
  has_many :organizations, through: :organization_memberships
  has_many :created_organizations, class_name: "Organization", foreign_key: :created_by_id, dependent: :restrict_with_error

  validates :clerk_id, presence: true, uniqueness: true
  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :role, presence: true

  def full_name
    [ first_name, last_name ].compact_blank.join(" ").presence || email.split("@").first
  end
end
