Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    configured_origins = ENV.fetch("ALLOWED_ORIGINS", "").split(",").map(&:strip).reject(&:blank?)
    allowed_origins = (configured_origins + [ Rails.application.config.x.public_app_origin ]).uniq
    origins allowed_origins

    resource "*",
      headers: :any,
      methods: [ :get, :post, :put, :patch, :delete, :options, :head ],
      credentials: true
  end
end
