Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check
  get "health", to: proc { [ 200, { "Content-Type" => "application/json" }, [ '{"status":"ok"}' ] ] }

  namespace :api do
    namespace :v1 do
      post "sessions", to: "sessions#create"
      resources :projects do
        resources :checkpoints, controller: "project_checkpoints", only: [ :index, :create ] do
          member do
            post :restore
          end
        end

        member do
          patch :archive
          post :duplicate
          patch :unarchive
        end
      end
      resources :shares, controller: "project_shares", param: :token, only: [ :create, :show ]
      resources :organizations, only: [ :index, :show, :create ] do
        member do
          get :members
          get :projects
          get "students/:student_id/projects", to: "organizations#student_projects"
          get :invitations
          post :invite
          post "invitations/:invitation_id/resend", to: "organizations#resend_invitation"
          delete "invitations/:invitation_id", to: "organizations#destroy_invitation"
          patch "members/:membership_id", to: "organizations#update_member"
          delete "members/:membership_id", to: "organizations#destroy_member"
        end
      end
      resources :invitations, controller: "organization_invitations", param: :token, only: [ :show ] do
        member do
          post :accept
        end
      end
    end
  end
end
