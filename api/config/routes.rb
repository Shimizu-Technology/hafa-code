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
    end
  end
end
