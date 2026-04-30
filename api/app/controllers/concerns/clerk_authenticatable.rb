module ClerkAuthenticatable
  extend ActiveSupport::Concern

  private

  def authenticate_user!
    header = request.headers["Authorization"]
    unless header.present?
      render_unauthorized("Missing authorization header")
      return
    end

    token = header.split.last
    decoded = ClerkAuth.verify(token)
    unless decoded
      render_unauthorized("Invalid or expired token")
      return
    end

    @current_user = find_or_create_user(
      clerk_id: decoded["sub"],
      email: decoded["email"] || decoded["primary_email_address"],
      first_name: decoded["first_name"],
      last_name: decoded["last_name"]
    )

    render_unauthorized("Unable to authenticate user") unless @current_user
  end

  def current_user
    @current_user
  end

  def find_or_create_user(clerk_id:, email:, first_name:, last_name:)
    return nil if clerk_id.blank?

    if email.blank? && ENV["CLERK_SECRET_KEY"].present?
      clerk_profile = fetch_clerk_profile(clerk_id)
      email = clerk_profile[:email]
      first_name ||= clerk_profile[:first_name]
      last_name ||= clerk_profile[:last_name]
    end

    user = User.find_by(clerk_id: clerk_id)
    if user
      updates = { last_sign_in_at: Time.current }
      updates[:email] = email if email.present? && email != user.email
      updates[:first_name] = first_name if first_name.present?
      updates[:last_name] = last_name if last_name.present?
      updates[:role] = :admin if owner_admin_email?(email || user.email) && !user.admin?
      user.update(updates)
      return user
    end

    if email.present?
      user = User.find_by("LOWER(email) = ?", email.downcase)
      if user
        user.update(
          clerk_id: clerk_id,
          first_name: first_name,
          last_name: last_name,
          last_sign_in_at: Time.current,
          role: owner_admin_email?(email) ? :admin : user.role
        )
        return user
      end
    end

    return nil if Rails.env.production? && !allow_open_signup?

    User.create(
      clerk_id: clerk_id,
      email: email.presence || "#{clerk_id}@placeholder.local",
      first_name: first_name,
      last_name: last_name,
      role: owner_admin_email?(email) ? :admin : :student,
      last_sign_in_at: Time.current
    )
  end

  def fetch_clerk_profile(clerk_id)
    response = HTTParty.get(
      "https://api.clerk.com/v1/users/#{clerk_id}",
      headers: { "Authorization" => "Bearer #{ENV.fetch('CLERK_SECRET_KEY')}" },
      timeout: 5
    )
    return {} unless response.success?

    clerk_user = response.parsed_response
    primary_email_id = clerk_user["primary_email_address_id"]
    email_addresses = clerk_user["email_addresses"] || []
    primary_email = email_addresses.find { |entry| entry["id"] == primary_email_id }
    {
      email: primary_email&.dig("email_address") || email_addresses.first&.dig("email_address"),
      first_name: clerk_user["first_name"],
      last_name: clerk_user["last_name"]
    }
  rescue => e
    Rails.logger.warn("Clerk API lookup failed: #{e.message}")
    {}
  end

  def owner_admin_email?(email)
    normalized = email.to_s.strip.downcase
    return false if normalized.blank?

    ENV.fetch("OWNER_ADMIN_EMAILS", "").split(",").map { |candidate| candidate.strip.downcase }.include?(normalized)
  end

  def allow_open_signup?
    Rails.env.development? || Rails.env.test? || ActiveModel::Type::Boolean.new.cast(ENV["ALLOW_OPEN_SIGNUPS"])
  end

  def render_unauthorized(message = "Unauthorized")
    render json: { error: message }, status: :unauthorized
  end

  def render_forbidden(message = "Forbidden")
    render json: { error: message }, status: :forbidden
  end
end
