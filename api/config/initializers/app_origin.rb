configured_origin = ENV["FRONTEND_URL"].presence || ENV["APP_URL"].presence
default_origin = Rails.env.production? ? "https://code.shimizu-technology.com" : "http://localhost:5173"

Rails.application.config.x.public_app_origin = (configured_origin || default_origin).delete_suffix("/")
