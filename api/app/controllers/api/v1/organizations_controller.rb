module Api
  module V1
    class OrganizationsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_organization, only: [
        :show,
        :members,
        :projects,
        :student_projects,
        :invite,
        :invitations,
        :resend_invitation,
        :destroy_invitation,
        :update_member,
        :destroy_member
      ]
      before_action :set_invitation, only: [ :resend_invitation, :destroy_invitation ]
      before_action :set_membership, only: [ :update_member, :destroy_member ]

      def index
        organizations = organization_scope.includes(:organization_memberships).order(:name)
        render json: { organizations: organizations.map { |organization| organization_json(organization) } }
      end

      def show
        render json: { organization: organization_json(@organization) }
      end

      def create
        return render_forbidden("Only platform admins and mentors can create organizations.") unless can_create_org?(current_user)

        retries = 0
        begin
          organization = nil
          ApplicationRecord.transaction do
            organization = current_user.created_organizations.create!(params.permit(:name))
            organization.organization_memberships.create!(user: current_user, role: :owner)
          end
          render json: { organization: organization_json(organization.reload) }, status: :created
        rescue ActiveRecord::RecordInvalid => e
          render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
        rescue ActiveRecord::RecordNotUnique
          retries += 1
          retry if retries < 3

          render json: { errors: [ "Organization slug is already taken. Please try again." ] }, status: :unprocessable_entity
        end
      end

      def members
        return render_forbidden unless can_view_org_roster?(current_user, @organization)

        memberships = @organization.organization_memberships.includes(:user).order(:role, "users.last_name", "users.first_name", "users.email")
        render json: { members: memberships.map { |membership| member_json(membership) } }
      end

      def projects
        projects = visible_organization_projects(@organization)
          .includes(:project_files, :user, :organization)
          .order(updated_at: :desc)
        render json: { projects: projects.map { |project| project_json(project) } }
      end

      def student_projects
        return render_forbidden unless can_view_org_roster?(current_user, @organization)

        student = @organization.members.find_by!(id: params[:student_id])
        projects = @organization.projects.includes(:project_files, :user, :organization)
          .where(user: student)
          .order(updated_at: :desc)
        render json: { student: user_json(student), projects: projects.map { |project| project_json(project) } }
      end

      def invite
        return render_forbidden unless can_invite_org_member?(current_user, @organization)
        role = invitation_role_param
        return render json: { errors: [ "Role is not valid" ] }, status: :unprocessable_entity unless role
        return render_forbidden("Only organization owners can invite instructors.") if role == "instructor" && !can_manage_org?(current_user, @organization)
        return render_invitation_url_configuration_error unless frontend_origin

        invitation = @organization.organization_invitations.new(
          invited_by: current_user,
          email: params[:email],
          role: role
        )

        if invitation.save
          invitation_url = organization_invitation_url(invitation)
          email_sent = OrganizationInviteEmailService.send_invite(invitation: invitation, invitation_url: invitation_url)

          render json: { invitation: invitation_json(invitation, invitation_url: invitation_url, email_sent: email_sent) }, status: :created
        else
          render json: { errors: invitation.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def invitations
        return render_forbidden unless can_invite_org_member?(current_user, @organization)

        invitations = manageable_invitations.pending.order(created_at: :desc).limit(50)
        render json: { invitations: invitations.map { |invitation| invitation_json(invitation, invitation_url: organization_invitation_url(invitation, require_configured_origin: false)) } }
      end

      def resend_invitation
        return render_forbidden unless can_invite_org_member?(current_user, @organization)
        return render_forbidden("Only organization owners can resend instructor invitations.") unless can_manage_invitation_role?(@invitation.role)
        return render json: { errors: [ "Invitation is no longer pending" ] }, status: :unprocessable_entity unless invitation_pending?(@invitation)
        return render_invitation_url_configuration_error unless frontend_origin

        invitation_url = organization_invitation_url(@invitation)
        email_sent = OrganizationInviteEmailService.send_invite(invitation: @invitation, invitation_url: invitation_url)
        render json: { invitation: invitation_json(@invitation, invitation_url: invitation_url, email_sent: email_sent) }
      end

      def destroy_invitation
        return render_forbidden unless can_invite_org_member?(current_user, @organization)
        return render_forbidden("Only organization owners can revoke instructor invitations.") unless can_manage_invitation_role?(@invitation.role)

        @invitation.destroy!
        head :no_content
      end

      def update_member
        return render_forbidden unless can_manage_org?(current_user, @organization)
        return render json: { errors: [ "You cannot change your own organization role." ] }, status: :unprocessable_entity if @membership.user_id == current_user.id

        role = membership_role_param
        return render json: { errors: [ "Role is not valid" ] }, status: :unprocessable_entity unless role

        owner_guard_error = nil
        ApplicationRecord.transaction do
          lock_owner_memberships!(@membership.organization) if @membership.owner? && role != "owner"
          if @membership.owner? && role != "owner" && last_owner_membership?(@membership)
            owner_guard_error = "Organization must keep at least one owner"
            raise ActiveRecord::Rollback
          end

          @membership.update!(role: role)
        end
        return render json: { errors: [ owner_guard_error ] }, status: :unprocessable_entity if owner_guard_error

        render json: { member: member_json(@membership.reload) }
      end

      def destroy_member
        return render_forbidden unless can_manage_org?(current_user, @organization)
        return render json: { errors: [ "You cannot remove yourself from the organization." ] }, status: :unprocessable_entity if @membership.user_id == current_user.id

        owner_guard_error = nil
        ApplicationRecord.transaction do
          lock_owner_memberships!(@membership.organization) if @membership.owner?
          if @membership.owner? && last_owner_membership?(@membership)
            owner_guard_error = "Organization must keep at least one owner"
            raise ActiveRecord::Rollback
          end

          @membership.destroy!
        end
        return render json: { errors: [ owner_guard_error ] }, status: :unprocessable_entity if owner_guard_error

        head :no_content
      end

      private

      def set_organization
        @organization = organization_scope.find(params[:id])
      end

      def set_invitation
        @invitation = @organization.organization_invitations.find(params[:invitation_id])
      end

      def set_membership
        @membership = @organization.organization_memberships.includes(:user).find(params[:membership_id])
      end

      def organization_scope
        current_user.admin? ? Organization.all : current_user.organizations
      end

      def organization_json(organization)
        membership = organization_membership_for(current_user, organization)
        {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          role: membership&.role,
          created_at: organization.created_at,
          updated_at: organization.updated_at
        }
      end

      def member_json(membership)
        user_json(membership.user).merge(
          membership_id: membership.id,
          organization_role: membership.role,
          joined_at: membership.created_at
        )
      end

      def user_json(user)
        {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          full_name: user.full_name,
          role: user.role
        }
      end

      def invitation_json(invitation, invitation_url: nil, email_sent: nil)
        {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
          invitation_url: invitation_url,
          email_sent: email_sent,
          accepted_at: invitation.accepted_at,
          expires_at: invitation.expires_at,
          created_at: invitation.created_at
        }.compact
      end

      def visible_organization_projects(organization)
        membership = organization_membership_for(current_user, organization)
        return organization.projects if current_user.admin? || membership&.instructor? || membership&.owner?

        organization.projects.where(
          "user_id = :user_id OR visibility IN (:member_visibilities)",
          user_id: current_user.id,
          member_visibilities: %w[organization public]
        )
      end

      def invitation_role_param
        role = params[:role].presence || "student"
        return role if OrganizationInvitation.roles.key?(role)

        nil
      end

      def membership_role_param
        role = params[:role].presence
        return role if OrganizationMembership.roles.key?(role)

        nil
      end

      def can_manage_invitation_role?(role)
        role == "student" || can_manage_org?(current_user, @organization)
      end

      def manageable_invitations
        invitations = @organization.organization_invitations
        return invitations if can_manage_org?(current_user, @organization)

        invitations.where(role: :student)
      end

      def invitation_pending?(invitation)
        !invitation.accepted? && !invitation.expired?
      end

      def last_owner_membership?(membership)
        membership.organization.organization_memberships.where(role: :owner).where.not(id: membership.id).none?
      end

      def lock_owner_memberships!(organization)
        organization.organization_memberships.where(role: :owner).lock.to_a
      end

      def organization_invitation_url(invitation, require_configured_origin: true)
        origin = frontend_origin(log_missing: require_configured_origin)
        return nil unless origin

        "#{origin}#invite=#{ERB::Util.url_encode(invitation.token)}"
      end

      def frontend_origin(log_missing: true)
        origin = ENV["FRONTEND_URL"].presence || ENV["APP_URL"].presence
        return origin.delete_suffix("/") if origin
        return "http://localhost:5173" unless Rails.env.production?

        Rails.logger.error("[OrganizationsController] FRONTEND_URL or APP_URL must be set before sending organization invitation links") if log_missing
        nil
      end

      def render_invitation_url_configuration_error
        render json: { errors: [ "Invitation links are not configured. Set FRONTEND_URL or APP_URL." ] }, status: :unprocessable_entity
      end
    end
  end
end
