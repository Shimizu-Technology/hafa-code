module Authorizable
  extend ActiveSupport::Concern

  private

  def organization_membership_for(user, organization)
    return nil unless user && organization

    organization.organization_memberships.find_by(user: user)
  end

  def organization_instructor?(user, organization)
    membership = organization_membership_for(user, organization)
    membership&.instructor? || membership&.owner?
  end

  def organization_member?(user, organization)
    organization_membership_for(user, organization).present?
  end

  def can_view_project?(user, project)
    return true if project.user_id == user&.id
    return true if project.visibility.in?(%w[public unlisted])
    return false unless project.organization

    return true if organization_instructor?(user, project.organization)
    project.visibility == "organization" && organization_member?(user, project.organization)
  end

  def can_edit_project?(user, project)
    project.user_id == user&.id
  end

  def can_manage_org?(user, organization)
    user&.admin? || organization_membership_for(user, organization)&.owner?
  end

  def can_view_org_roster?(user, organization)
    user&.admin? || organization_instructor?(user, organization)
  end

  def can_invite_org_member?(user, organization)
    can_manage_org?(user, organization) || organization_instructor?(user, organization)
  end

  def can_create_org?(user)
    user&.admin? || user&.mentor? || ActiveModel::Type::Boolean.new.cast(ENV["ALLOW_ORGANIZATION_CREATION"])
  end
end
