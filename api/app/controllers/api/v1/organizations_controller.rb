module Api
  module V1
    class OrganizationsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_organization, only: [ :show, :members, :projects, :student_projects, :invite, :invitations ]

      def index
        organizations = current_user.organizations.includes(:organization_memberships).order(:name)
        render json: { organizations: organizations.map { |organization| organization_json(organization) } }
      end

      def show
        render json: { organization: organization_json(@organization) }
      end

      def create
        return render_forbidden("Only platform admins and mentors can create organizations.") unless can_create_org?(current_user)

        retries = 0
        begin
          organization = current_user.created_organizations.new(params.permit(:name))
          if organization.save
            organization.organization_memberships.create!(user: current_user, role: :owner)
            render json: { organization: organization_json(organization.reload) }, status: :created
          else
            render json: { errors: organization.errors.full_messages }, status: :unprocessable_entity
          end
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

        invitation = @organization.organization_invitations.new(
          invited_by: current_user,
          email: params[:email],
          role: role
        )

        if invitation.save
          render json: { invitation: invitation_json(invitation) }, status: :created
        else
          render json: { errors: invitation.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def invitations
        return render_forbidden unless can_invite_org_member?(current_user, @organization)

        invitations = @organization.organization_invitations.order(created_at: :desc).limit(50)
        render json: { invitations: invitations.map { |invitation| invitation_json(invitation) } }
      end

      private

      def set_organization
        @organization = current_user.organizations.find(params[:id])
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

      def invitation_json(invitation)
        {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
          accepted_at: invitation.accepted_at,
          expires_at: invitation.expires_at,
          created_at: invitation.created_at
        }
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
    end
  end
end
