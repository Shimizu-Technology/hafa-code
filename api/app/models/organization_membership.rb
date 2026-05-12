class OrganizationMembership < ApplicationRecord
  enum :role, { student: 0, instructor: 1, owner: 2 }

  belongs_to :organization
  belongs_to :user

  validates :role, presence: true
  validates :user_id, uniqueness: { scope: :organization_id }
end
