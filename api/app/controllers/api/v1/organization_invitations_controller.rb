module Api
  module V1
    class OrganizationInvitationsController < ApplicationController
      before_action :authenticate_user!, only: [ :accept ]

      def show
        invitation = OrganizationInvitation.pending.find_by!(token: params[:token])
        render json: { invitation: invitation_json(invitation) }
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Invitation not found" }, status: :not_found
      end

      def accept
        invitation = OrganizationInvitation.pending.find_by!(token: params[:token])
        if invitation.email != current_user.email.downcase
          return render_forbidden("This invitation is for a different account.")
        end

        accept_invitation!(invitation)

        render json: { organization: organization_json(invitation.organization) }
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Invitation not found" }, status: :not_found
      end

      private

      def accept_invitation!(invitation)
        ApplicationRecord.transaction do
          accept_membership!(invitation)
          invitation.update!(accepted_at: Time.current)
        end
      end

      def accept_membership!(invitation)
        membership = OrganizationMembership.find_by(organization: invitation.organization, user: current_user) ||
          create_membership_for_invitation!(invitation)

        membership.with_lock do
          invited_role_rank = OrganizationMembership.roles.fetch(invitation.role)
          current_role_rank = membership.role ? OrganizationMembership.roles.fetch(membership.role) : -1
          if invited_role_rank > current_role_rank
            membership.update!(role: invitation.role)
          end
        end
      end

      def create_membership_for_invitation!(invitation)
        OrganizationMembership.create!(
          organization: invitation.organization,
          user: current_user,
          role: invitation.role
        )
      rescue ActiveRecord::RecordNotUnique
        OrganizationMembership.find_by!(organization: invitation.organization, user: current_user)
      end

      def organization_json(organization)
        membership = organization_membership_for(current_user, organization)
        {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          role: membership&.role
        }
      end

      def invitation_json(invitation)
        {
          token: invitation.token,
          email: invitation.email,
          role: invitation.role,
          organization: {
            id: invitation.organization.id,
            name: invitation.organization.name,
            slug: invitation.organization.slug
          },
          expires_at: invitation.expires_at
        }
      end
    end
  end
end
