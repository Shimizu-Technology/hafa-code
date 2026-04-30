module Api
  module V1
    class SessionsController < ApplicationController
      before_action :authenticate_user!

      def create
        render json: { user: user_json(current_user) }
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
    end
  end
end
