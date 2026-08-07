class OrganizationInviteEmailJob < ApplicationJob
  queue_as :mailers

  discard_on ActiveRecord::RecordNotFound
  retry_on StandardError, wait: :polynomially_longer, attempts: 5

  def perform(invitation_id, invitation_url)
    invitation = OrganizationInvitation.find(invitation_id)
    response = OrganizationInviteEmailService.send_invite!(
      invitation: invitation,
      invitation_url: invitation_url
    )

    invitation.with_lock do
      invitation.update!(
        delivery_status: "sent",
        delivery_error: nil,
        last_sent_at: Time.current,
        send_attempts: invitation.send_attempts + 1,
        provider_message_id: provider_message_id(response)
      )
    end
  rescue => e
    invitation&.with_lock do
      invitation.update_columns(
        delivery_status: "failed",
        delivery_error: e.message.to_s.first(500),
        send_attempts: invitation.send_attempts + 1,
        updated_at: Time.current
      )
    end
    raise
  end

  private

  def provider_message_id(response)
    return response["id"] if response.respond_to?(:[]) && response["id"].present?
    return response.id if response.respond_to?(:id)

    nil
  end
end
