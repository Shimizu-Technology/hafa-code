require "test_helper"

class OrganizationInviteEmailJobTest < ActiveJob::TestCase
  setup do
    @owner = User.create!(
      clerk_id: "invite-job-owner",
      email: "invite-job-owner@example.com",
      first_name: "Invite",
      last_name: "Owner",
      role: :mentor
    )
    @organization = Organization.create!(name: "Invite Job School", created_by: @owner)
    @organization.organization_memberships.create!(user: @owner, role: :owner)
    @invitation = @organization.organization_invitations.create!(
      invited_by: @owner,
      email: "invite-job-student@example.com",
      role: :student,
      delivery_status: "queued"
    )
  end

  test "records a successful provider delivery" do
    original_send_invite = OrganizationInviteEmailService.method(:send_invite!)
    OrganizationInviteEmailService.define_singleton_method(:send_invite!) do |**|
      { "id" => "provider-message-123" }
    end

    OrganizationInviteEmailJob.perform_now(@invitation.id, "https://hafa-code.netlify.app/#invite=test")

    @invitation.reload
    assert_equal "sent", @invitation.delivery_status
    assert_equal "provider-message-123", @invitation.provider_message_id
    assert_equal 1, @invitation.send_attempts
    assert_not_nil @invitation.last_sent_at
    assert_nil @invitation.delivery_error
  ensure
    OrganizationInviteEmailService.define_singleton_method(:send_invite!, original_send_invite)
  end

  test "records a failed delivery before retrying" do
    original_send_invite = OrganizationInviteEmailService.method(:send_invite!)
    OrganizationInviteEmailService.define_singleton_method(:send_invite!) do |**|
      raise StandardError, "provider unavailable"
    end

    assert_enqueued_jobs 1, only: OrganizationInviteEmailJob do
      OrganizationInviteEmailJob.perform_now(@invitation.id, "https://hafa-code.netlify.app/#invite=test")
    end

    @invitation.reload
    assert_equal "failed", @invitation.delivery_status
    assert_equal 1, @invitation.send_attempts
    assert_equal "provider unavailable", @invitation.delivery_error
  ensure
    OrganizationInviteEmailService.define_singleton_method(:send_invite!, original_send_invite)
  end
end
