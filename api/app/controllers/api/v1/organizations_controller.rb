module Api
  module V1
    class OrganizationsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_organization, only: [
        :show,
        :update,
        :archive,
        :unarchive,
        :members,
        :projects,
        :export,
        :audit_events,
        :student_projects,
        :invite,
        :bulk_invite,
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

      def update
        return render_forbidden unless can_manage_org?(current_user, @organization)
        return render_archived_organization_error if @organization.archived?

        before = @organization.slice("name", "school_year")
        if @organization.update(params.permit(:name, :school_year))
          audit_event!(
            "organization.updated",
            organization: @organization,
            target: @organization,
            metadata: { before: before, after: @organization.slice("name", "school_year") }
          )
          render json: { organization: organization_json(@organization.reload) }
        else
          render json: { errors: @organization.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def archive
        return render_forbidden unless can_manage_org?(current_user, @organization)

        @organization.update!(archived_at: Time.current)
        audit_event!("organization.archived", organization: @organization, target: @organization)
        render json: { organization: organization_json(@organization.reload) }
      end

      def unarchive
        return render_forbidden unless can_manage_org?(current_user, @organization)

        @organization.update!(archived_at: nil)
        audit_event!("organization.restored", organization: @organization, target: @organization)
        render json: { organization: organization_json(@organization.reload) }
      end

      def create
        return render_forbidden("Only platform admins and mentors can create organizations.") unless can_create_org?(current_user)

        retries = 0
        begin
          organization = nil
          ApplicationRecord.transaction do
            organization = current_user.created_organizations.create!(params.permit(:name))
            organization.organization_memberships.create!(user: current_user, role: :owner)
            audit_event!("organization.created", organization: organization, target: organization)
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
        scope = visible_organization_projects(@organization).order(updated_at: :desc, id: :desc)
        projects, pagination = paginate(scope.includes(:project_files, :user, :organization))
        render json: {
          projects: projects.map { |project| project_json(project) },
          pagination: pagination
        }
      end

      def export
        membership = organization_membership_for(current_user, @organization)
        return render_forbidden unless current_user.admin? || membership

        can_export_class = current_user.admin? || membership&.instructor? || membership&.owner?
        projects = @organization.projects
          .includes(:project_files, :user, :organization, project_comments: [ :user, :resolved_by ])
          .order(:user_id, :created_at)
        projects = projects.where(user: current_user) unless can_export_class
        memberships = @organization.organization_memberships.includes(:user)
        memberships = memberships.where(user: current_user) unless can_export_class
        audit_event!(
          can_export_class ? "organization.exported" : "organization.personal_work_exported",
          organization: @organization,
          target: @organization,
          metadata: { project_count: projects.size, member_count: memberships.size }
        )

        render json: {
          export: {
            version: 1,
            exported_at: Time.current,
            organization: organization_json(@organization),
            members: memberships.map { |candidate| member_json(candidate) },
            projects: projects.map { |project| project_export_json(project) }
          }
        }
      end

      def audit_events
        return render_forbidden unless can_manage_org?(current_user, @organization)

        events = @organization.audit_events.includes(:actor).order(created_at: :desc, id: :desc).limit(100)
        render json: {
          audit_events: events.map do |event|
            {
              id: event.id,
              action: event.action,
              actor: event.actor && { id: event.actor.id, full_name: event.actor.full_name },
              target_type: event.target_type,
              target_id: event.target_id,
              metadata: event.metadata,
              created_at: event.created_at
            }
          end
        }
      end

      def student_projects
        return render_forbidden unless can_view_org_roster?(current_user, @organization)

        student = @organization.members.find_by!(id: params[:student_id])
        scope = @organization.projects.where(user: student).order(updated_at: :desc, id: :desc)
        projects, pagination = paginate(scope.includes(:project_files, :user, :organization))
        render json: {
          student: user_json(student),
          projects: projects.map { |project| project_json(project) },
          pagination: pagination
        }
      end

      def invite
        return render_forbidden unless can_invite_org_member?(current_user, @organization)
        return render_archived_organization_error if @organization.archived?
        role = invitation_role_param
        return render json: { errors: [ "Role is not valid" ] }, status: :unprocessable_entity unless role
        return render_forbidden("Only organization owners can invite instructors.") if role == "instructor" && !can_manage_org?(current_user, @organization)
        return render_invitation_url_configuration_error unless frontend_origin

        normalized_email = params[:email].to_s.strip.downcase
        return render_email_domain_error unless invitation_email_domain_allowed?(normalized_email)
        begin
          invitation = create_or_renew_invitation(normalized_email, role)
          invitation_url = organization_invitation_url(invitation)
          email_queued = enqueue_invitation_email(invitation, invitation_url)
          audit_event!(
            "organization.invitation.created",
            organization: @organization,
            target: invitation,
            metadata: { role: invitation.role, email_queued: email_queued }
          )

          render json: { invitation: invitation_json(invitation, invitation_url: invitation_url, email_queued: email_queued) }, status: :created
        rescue ActiveRecord::RecordInvalid => e
          render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
        end
      end

      def bulk_invite
        return render_forbidden unless can_invite_org_member?(current_user, @organization)
        return render_archived_organization_error if @organization.archived?
        role = invitation_role_param
        return render json: { errors: [ "Role is not valid" ] }, status: :unprocessable_entity unless role
        return render_forbidden("Only organization owners can invite instructors.") if role == "instructor" && !can_manage_org?(current_user, @organization)
        return render_invitation_url_configuration_error unless frontend_origin

        emails = Array(params[:emails]).flat_map { |value| value.to_s.split(/[\s,;]+/) }
          .map { |email| email.strip.downcase }
          .reject(&:blank?)
          .uniq
        return render json: { errors: [ "Enter at least one email address" ] }, status: :unprocessable_entity if emails.empty?
        return render json: { errors: [ "Invite up to 100 people at a time" ] }, status: :unprocessable_entity if emails.length > 100

        invitations = []
        errors = []
        emails.each do |email|
          unless invitation_email_domain_allowed?(email)
            errors << { email: email, errors: [ "Email domain is not allowed for this workspace" ] }
            next
          end

          begin
            invitation = create_or_renew_invitation(email, role)
          rescue ActiveRecord::RecordInvalid => e
            errors << { email: email, errors: e.record.errors.full_messages }
            next
          end

          invitation_url = organization_invitation_url(invitation)
          email_queued = enqueue_invitation_email(invitation, invitation_url)
          audit_event!(
            "organization.invitation.created",
            organization: @organization,
            target: invitation,
            metadata: { role: invitation.role, email_queued: email_queued, bulk: true }
          )
          invitations << invitation_json(invitation, invitation_url: invitation_url, email_queued: email_queued)
        end

        render json: { invitations: invitations, errors: errors }, status: errors.any? ? :multi_status : :created
      end

      def invitations
        return render_forbidden unless can_invite_org_member?(current_user, @organization)

        invitations = manageable_invitations.pending.order(created_at: :desc).limit(50)
        render json: { invitations: invitations.map { |invitation| invitation_json(invitation, invitation_url: organization_invitation_url(invitation, require_configured_origin: false)) } }
      end

      def resend_invitation
        return render_forbidden unless can_invite_org_member?(current_user, @organization)
        return render_archived_organization_error if @organization.archived?
        return render_forbidden("Only organization owners can resend instructor invitations.") unless can_manage_invitation_role?(@invitation.role)
        return render json: { errors: [ "Invitation is no longer pending" ] }, status: :unprocessable_entity unless invitation_pending?(@invitation)
        return render_invitation_url_configuration_error unless frontend_origin

        invitation_url = organization_invitation_url(@invitation)
        email_queued = enqueue_invitation_email(@invitation, invitation_url)
        audit_event!(
          "organization.invitation.resent",
          organization: @organization,
          target: @invitation,
          metadata: { role: @invitation.role, email_queued: email_queued }
        )
        render json: { invitation: invitation_json(@invitation, invitation_url: invitation_url, email_queued: email_queued) }
      end

      def destroy_invitation
        return render_forbidden unless can_invite_org_member?(current_user, @organization)
        return render_archived_organization_error if @organization.archived?
        return render_forbidden("Only organization owners can revoke instructor invitations.") unless can_manage_invitation_role?(@invitation.role)

        ApplicationRecord.transaction do
          audit_event!("organization.invitation.revoked", organization: @organization, target: @invitation, metadata: { role: @invitation.role })
          @invitation.destroy!
        end
        head :no_content
      end

      def update_member
        return render_forbidden unless can_manage_org?(current_user, @organization)
        return render_archived_organization_error if @organization.archived?
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

          previous_role = @membership.role
          @membership.update!(role: role)
          audit_event!(
            "organization.member.role_changed",
            organization: @organization,
            target: @membership.user,
            metadata: { from: previous_role, to: role }
          )
        end
        return render json: { errors: [ owner_guard_error ] }, status: :unprocessable_entity if owner_guard_error

        render json: { member: member_json(@membership.reload) }
      end

      def destroy_member
        return render_forbidden unless can_manage_org?(current_user, @organization)
        return render_archived_organization_error if @organization.archived?
        return render json: { errors: [ "You cannot remove yourself from the organization." ] }, status: :unprocessable_entity if @membership.user_id == current_user.id

        owner_guard_error = nil
        ApplicationRecord.transaction do
          lock_owner_memberships!(@membership.organization) if @membership.owner?
          if @membership.owner? && last_owner_membership?(@membership)
            owner_guard_error = "Organization must keep at least one owner"
            raise ActiveRecord::Rollback
          end

          @membership.user.projects.where(organization: @membership.organization).update_all(
            organization_id: nil,
            visibility: "private",
            updated_at: Time.current
          )
          audit_event!(
            "organization.member.removed",
            organization: @organization,
            target: @membership.user,
            metadata: { previous_role: @membership.role }
          )
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
          role: membership&.role || (current_user.admin? ? "admin" : nil),
          school_year: organization.school_year,
          archived_at: organization.archived_at,
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

      def invitation_json(invitation, invitation_url: nil, email_queued: nil)
        {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
          invitation_url: invitation_url,
          email_queued: email_queued,
          delivery_status: invitation.delivery_status,
          delivery_error: invitation.delivery_error,
          last_sent_at: invitation.last_sent_at,
          send_attempts: invitation.send_attempts,
          accepted_at: invitation.accepted_at,
          expires_at: invitation.expires_at,
          created_at: invitation.created_at
        }.compact
      end

      def project_export_json(project)
        project_json(project).merge(
          comments: project.project_comments.map do |comment|
            {
              id: comment.id,
              body: comment.body,
              file_path: comment.file_path,
              line_number: comment.line_number,
              author: comment.user.full_name,
              resolved_at: comment.resolved_at,
              resolved_by: comment.resolved_by&.full_name,
              created_at: comment.created_at,
              updated_at: comment.updated_at
            }
          end
        )
      end

      def enqueue_invitation_email(invitation, invitation_url)
        return false unless OrganizationInviteEmailService.configured?

        invitation.update!(delivery_status: "queued", delivery_error: nil)
        OrganizationInviteEmailJob.perform_later(invitation.id, invitation_url)
        true
      rescue => e
        invitation.update_columns(
          delivery_status: "failed",
          delivery_error: e.message.to_s.first(500),
          updated_at: Time.current
        )
        Rails.logger.error("[OrganizationsController] could not enqueue invitation #{invitation.id}: #{e.class} #{e.message}")
        false
      end

      def create_or_renew_invitation(email, role)
        retries = 0
        begin
          OrganizationInvitation.transaction(requires_new: true) do
            invitation = @organization.organization_invitations
              .where(email: email, accepted_at: nil)
              .lock
              .first

            if invitation
              invitation.renew!(invited_by: current_user, role: role)
              invitation
            else
              @organization.organization_invitations.create!(
                invited_by: current_user,
                email: email,
                role: role
              )
            end
          end
        rescue ActiveRecord::RecordNotUnique
          retries += 1
          retry if retries < 3

          raise
        end
      end

      def invitation_email_domain_allowed?(email)
        domains = ENV.fetch("ALLOWED_MEMBER_EMAIL_DOMAINS", "").split(",")
          .map { |domain| domain.strip.downcase.delete_prefix("@") }
          .reject(&:blank?)
        return true if domains.empty?

        domains.include?(email.to_s.split("@", 2).last.to_s.downcase)
      end

      def render_email_domain_error
        render json: { errors: [ "Email domain is not allowed for this workspace" ] }, status: :unprocessable_entity
      end

      def render_archived_organization_error
        render json: { errors: [ "This classroom is archived and read-only" ] }, status: :unprocessable_entity
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
        Rails.application.config.x.public_app_origin
      end

      def render_invitation_url_configuration_error
        render json: { errors: [ "Invitation links are not configured. Set FRONTEND_URL or APP_URL." ] }, status: :unprocessable_entity
      end

      def paginate(scope)
        page = positive_integer_param(:page, 1)
        per_page = [ positive_integer_param(:per_page, 50), 100 ].min
        total_count = scope.count
        records = scope.offset((page - 1) * per_page).limit(per_page)
        [
          records,
          {
            page: page,
            per_page: per_page,
            total_count: total_count,
            total_pages: (total_count.to_f / per_page).ceil
          }
        ]
      end

      def positive_integer_param(name, default)
        value = Integer(params[name], exception: false)
        value&.positive? ? value : default
      end
    end
  end
end
