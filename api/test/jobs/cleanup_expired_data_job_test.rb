require "test_helper"

class CleanupExpiredDataJobTest < ActiveJob::TestCase
  test "removes expired shares and unused invitations while keeping current records" do
    owner = User.create!(
      clerk_id: "cleanup-owner",
      email: "cleanup-owner@example.com",
      first_name: "Cleanup",
      last_name: "Owner"
    )
    organization = Organization.create!(name: "Cleanup School", created_by: owner)
    expired_invitation = organization.organization_invitations.create!(
      invited_by: owner,
      email: "expired@example.com",
      role: :student,
      expires_at: 1.minute.ago
    )
    current_invitation = organization.organization_invitations.create!(
      invited_by: owner,
      email: "current@example.com",
      role: :student,
      expires_at: 1.day.from_now
    )
    expired_share = ProjectShare.create!(
      title: "Expired",
      kind: "ruby",
      snapshot: { files: [ { path: "main.rb", content: "puts 1" } ] },
      expires_at: 1.minute.ago
    )
    current_share = ProjectShare.create!(
      title: "Current",
      kind: "ruby",
      snapshot: { files: [ { path: "main.rb", content: "puts 2" } ] },
      expires_at: 1.day.from_now
    )

    CleanupExpiredDataJob.perform_now

    assert_not OrganizationInvitation.exists?(expired_invitation.id)
    assert OrganizationInvitation.exists?(current_invitation.id)
    assert_not ProjectShare.exists?(expired_share.id)
    assert ProjectShare.exists?(current_share.id)
  end
end
