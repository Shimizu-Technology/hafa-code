Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check
  get "health", to: proc { [ 200, { "Content-Type" => "application/json" }, [ '{"status":"ok"}' ] ] }

  namespace :api do
    namespace :v1 do
      post "sessions", to: "sessions#create"
      resources :projects do
        member do
          post :duplicate
        end
      end
    end
  end
end
