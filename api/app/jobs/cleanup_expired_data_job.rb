class CleanupExpiredDataJob < ApplicationJob
  queue_as :maintenance

  def perform
    now = Time.current
    ProjectShare.where(expires_at: ...now).delete_all
    OrganizationInvitation.where(accepted_at: nil, expires_at: ...now).delete_all
    ApiRateLimit.where(window_started_at: ...1.day.ago).delete_all
  end
end
