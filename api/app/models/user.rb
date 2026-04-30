class User < ApplicationRecord
  enum :role, { student: 0, mentor: 1, admin: 2 }

  has_many :projects, dependent: :destroy

  validates :clerk_id, presence: true, uniqueness: true
  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :role, presence: true

  def full_name
    [ first_name, last_name ].compact_blank.join(" ").presence || email.split("@").first
  end
end
