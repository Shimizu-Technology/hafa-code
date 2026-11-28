require "test_helper"

class OrganizationInviteEmailServiceTest < ActiveSupport::TestCase
  setup do
    @previous_resend_key = ENV["RESEND_API_KEY"]
    @previous_from = ENV["RESEND_FROM_EMAIL"]
    @previous_reply_to = ENV["MAILER_REPLY_TO_EMAIL"]
    ENV["RESEND_API_KEY"] = "re_test_key"
    ENV["RESEND_FROM_EMAIL"] = "noreply@shimizu-technology.com"
    ENV["MAILER_REPLY_TO_EMAIL"] = nil

    @owner = User.create!(
      clerk_id: "invite-service-owner",
      email: "invite-service-owner@example.com",
      first_name: "Invite",
      last_name: "Owner",
      role: :mentor
    )
    @organization = Organization.create!(name: "Invite Service School", created_by: @owner)
    @organization.organization_memberships.create!(user: @owner, role: :owner)
    @invitation = @organization.organization_invitations.create!(
      invited_by: @owner,
      email: "invite-service-student@example.com",
      role: :student,
      delivery_status: "queued"
    )
  end

  teardown do
    ENV["RESEND_API_KEY"] = @previous_resend_key
    ENV["RESEND_FROM_EMAIL"] = @previous_from
    ENV["MAILER_REPLY_TO_EMAIL"] = @previous_reply_to
  end

  test "send_invite! sets default support reply_to" do
    captured_payload = nil
    original_send = Resend::Emails.method(:send)
    Resend::Emails.define_singleton_method(:send) do |payload|
      captured_payload = payload
      { "id" => "re_invite_123" }
    end

    OrganizationInviteEmailService.send_invite!(
      invitation: @invitation,
      invitation_url: "https://code.shimizu-technology.com/#invite=test"
    )

    assert_equal "noreply@shimizu-technology.com", captured_payload.fetch(:from)
    assert_equal "support@shimizu-technology.com", captured_payload.fetch(:reply_to)
  ensure
    Resend::Emails.define_singleton_method(:send, original_send)
  end

  test "send_invite! respects MAILER_REPLY_TO_EMAIL override" do
    ENV["MAILER_REPLY_TO_EMAIL"] = "classroom-help@example.test"
    captured_payload = nil
    original_send = Resend::Emails.method(:send)
    Resend::Emails.define_singleton_method(:send) do |payload|
      captured_payload = payload
      { "id" => "re_invite_456" }
    end

    OrganizationInviteEmailService.send_invite!(
      invitation: @invitation,
      invitation_url: "https://code.shimizu-technology.com/#invite=test"
    )

    assert_equal "classroom-help@example.test", captured_payload.fetch(:reply_to)
  ensure
    Resend::Emails.define_singleton_method(:send, original_send)
  end
end
