class ClerkAuth
  JWKS_CACHE_KEY = "clerk_jwks"
  JWKS_CACHE_TTL = 1.hour

  class << self
    def verify(token)
      return nil if token.blank?

      if Rails.env.test? && token.start_with?("test_token_")
        return handle_test_token(token)
      end

      jwks = fetch_jwks
      return nil unless jwks

      decode_options = {
        algorithms: [ "RS256" ],
        jwks: jwks
      }

      issuer = ENV.fetch("CLERK_ISSUER", nil)
      if issuer.present?
        decode_options[:verify_iss] = true
        decode_options[:iss] = issuer
      elsif Rails.env.production?
        Rails.logger.error("CLERK_ISSUER is required in production")
        return nil
      end

      audience = ENV.fetch("CLERK_AUDIENCE", nil)
      if audience.present?
        audiences = audience.split(",").map(&:strip).reject(&:empty?)
        decode_options[:verify_aud] = true
        decode_options[:aud] = audiences.one? ? audiences.first : audiences
      end

      JWT.decode(token, nil, true, decode_options).first
    rescue JWT::DecodeError => e
      Rails.logger.warn("JWT decode error: #{e.message}")
      nil
    rescue JWT::ExpiredSignature
      Rails.logger.debug("JWT token expired")
      nil
    end

    private

    def fetch_jwks
      cached = Rails.cache.read(JWKS_CACHE_KEY)
      return cached if cached.present?

      uri = ENV.fetch("CLERK_JWKS_URL", nil)
      uri ||= "#{ENV.fetch('CLERK_ISSUER')}/.well-known/jwks.json" if ENV.fetch("CLERK_ISSUER", nil).present?
      return nil unless uri

      response = HTTParty.get(uri, timeout: 5)
      return nil unless response.success?

      Rails.cache.write(JWKS_CACHE_KEY, response.parsed_response, expires_in: JWKS_CACHE_TTL)
      response.parsed_response
    rescue HTTParty::Error, Timeout::Error => e
      Rails.logger.error("Error fetching Clerk JWKS: #{e.message}")
      nil
    end

    def handle_test_token(token)
      user_id = token.delete_prefix("test_token_")
      user = User.find_by(id: user_id)
      return nil unless user

      {
        "sub" => user.clerk_id || "test_clerk_#{user.id}",
        "email" => user.email,
        "first_name" => user.first_name,
        "last_name" => user.last_name
      }
    end
  end
end
