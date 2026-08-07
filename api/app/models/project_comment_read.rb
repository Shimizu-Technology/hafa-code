class ProjectCommentRead < ApplicationRecord
  belongs_to :project
  belongs_to :user

  validates :read_at, presence: true
  validates :user_id, uniqueness: { scope: :project_id }
end
