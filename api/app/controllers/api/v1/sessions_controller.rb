module Api
  module V1
    class SessionsController < ApplicationController
      before_action :authenticate_user!

      def create
        render json: {
          user: user_json(current_user),
          organizations: current_user.organizations.includes(:organization_memberships).order(:name).map { |organization| organization_json(organization) }
        }
      end

      private

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

      def organization_json(organization)
        membership = organization_membership_for(current_user, organization)
        {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          role: membership&.role
        }
      end
    end
  end
end
