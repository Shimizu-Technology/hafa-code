require "cgi"

class OrganizationInviteEmailService
  BRAND_NAME = "Hafa Code"

  class << self
    def send_invite(invitation:, invitation_url:)
      return false unless configured?

      response = Resend::Emails.send(
        {
          from: from_email,
          to: invitation.email,
          subject: "#{invitation.invited_by.full_name} invited you to #{invitation.organization.name} on #{BRAND_NAME}",
          html: invite_html(invitation: invitation, invitation_url: invitation_url),
          text: invite_text(invitation: invitation, invitation_url: invitation_url)
        }
      )

      Rails.logger.info("[OrgInviteEmail] sent invite to #{invitation.email} response=#{response.inspect}")
      true
    rescue StandardError => e
      Rails.logger.error("[OrgInviteEmail] failed for #{invitation.email}: #{e.class} #{e.message}")
      false
    end

    def configured?
      if ENV["RESEND_API_KEY"].blank?
        Rails.logger.warn("[OrgInviteEmail] RESEND_API_KEY not configured; skipping invite email")
        return false
      end

      if from_email.blank?
        Rails.logger.warn("[OrgInviteEmail] RESEND_FROM_EMAIL or MAILER_FROM_EMAIL not configured; skipping invite email")
        return false
      end

      true
    end

    private

    def from_email
      ENV["RESEND_FROM_EMAIL"].presence || ENV["MAILER_FROM_EMAIL"].presence
    end

    def h(value)
      CGI.escapeHTML(value.to_s)
    end

    def invite_text(invitation:, invitation_url:)
      inviter = invitation.invited_by.full_name.presence || invitation.invited_by.email
      <<~TEXT
        #{inviter} invited you to #{invitation.organization.name} on #{BRAND_NAME}.

        You were invited as #{invitation.role == "instructor" ? "an instructor" : "a student"}.

        Open this link to accept the invitation:
        #{invitation_url}

        If you do not have an account yet, create one with #{invitation.email}; Hafa Code will create your personal account and then add you to the classroom workspace.
      TEXT
    end

    def invite_html(invitation:, invitation_url:)
      organization_name = h(invitation.organization.name)
      inviter = h(invitation.invited_by.full_name.presence || invitation.invited_by.email)
      invitee_email = h(invitation.email)
      role_label = invitation.role == "instructor" ? "Instructor" : "Student"
      expires_at = invitation.expires_at&.strftime("%b %-d, %Y")

      <<~HTML
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta name="color-scheme" content="light dark">
            <meta name="supported-color-schemes" content="light dark">
            <title>#{h(BRAND_NAME)} classroom invitation</title>
            <style>
              :root { color-scheme: light dark; supported-color-schemes: light dark; }
              body, .email-shell { background: #fff6e4 !important; }
              .invite-card { background: #fffaf1 !important; }
              .info-box { background: #f3eadc !important; }
              @media screen and (max-width: 560px) {
                .outer-pad { padding: 0 !important; }
                .invite-card { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
                .content-pad { padding-left: 22px !important; padding-right: 22px !important; }
                .invite-heading { font-size: 25px !important; line-height: 1.18 !important; }
                .cta-link { display: block !important; padding-left: 24px !important; padding-right: 24px !important; }
              }
            </style>
          </head>
          <body bgcolor="#fff6e4" style="margin:0; padding:0; background:#fff6e4; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; -webkit-font-smoothing:antialiased;">
            <table class="email-shell" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#fff6e4" style="background:#fff6e4;">
              <tr>
                <td class="outer-pad" align="center" style="padding:40px 16px;">
                  <table class="invite-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#fffaf1" style="max-width:560px; background:#fffaf1; border:1px solid #eadfce; border-radius:16px; overflow:hidden;">
                    <tr><td style="height:4px; background:#ff5b45; font-size:0; line-height:0;">&nbsp;</td></tr>
                    <tr>
                      <td class="content-pad" style="padding:30px 34px 0; text-align:center;">
                        <p style="margin:0 0 10px; color:#c93422; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; font-weight:800;">Classroom invitation</p>
                        <h1 class="invite-heading" style="margin:0; color:#14110f; font-size:30px; line-height:1.22; font-weight:800;">Join #{organization_name} on #{h(BRAND_NAME)}</h1>
                      </td>
                    </tr>
                    <tr>
                      <td class="content-pad" style="padding:20px 34px 0; text-align:center;">
                        <p style="margin:0; color:#5b5048; font-size:16px; line-height:1.65;">
                          #{inviter} invited you as <strong style="color:#14110f;">#{h(role_label)}</strong>.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td class="content-pad" style="padding:22px 34px 0;">
                        <table class="info-box" role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f3eadc" style="background:#f3eadc; border:1px solid #dfd1bf; border-radius:12px;">
                          <tr>
                            <td style="padding:18px;">
                              <p style="margin:0 0 6px; color:#c93422; font-size:11px; letter-spacing:0.16em; text-transform:uppercase; font-weight:800;">How it works</p>
                              <p style="margin:0; color:#5b5048; font-size:14px; line-height:1.65;">
                                Sign in if you already have an account, or create one with <strong style="color:#14110f;">#{invitee_email}</strong>.
                                Hafa Code will keep your personal projects separate and add this classroom workspace after you accept.
                              </p>
                              #{expires_at ? "<p style=\"margin:10px 0 0; color:#7b6f65; font-size:13px; line-height:1.5;\">This invitation expires on #{h(expires_at)}.</p>" : ""}
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td class="content-pad" align="center" style="padding:26px 34px 0;">
                        <table role="presentation" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="border-radius:999px; background:#ff5b45;">
                              <a class="cta-link" href="#{h(invitation_url)}" target="_blank" style="display:inline-block; padding:15px 34px; color:#ffffff; text-decoration:none; font-size:16px; font-weight:800;">Accept invitation</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td class="content-pad" style="padding:18px 34px 34px; text-align:center;">
                        <p style="margin:0 0 5px; color:#7b6f65; font-size:12px;">Or copy and paste this link:</p>
                        <p style="margin:0; color:#136f63; font-size:12px; line-height:1.55; word-break:break-all;">
                          <a href="#{h(invitation_url)}" style="color:#136f63; text-decoration:underline;">#{h(invitation_url)}</a>
                        </p>
                        <p style="margin:18px 0 0; color:#9a8d80; font-size:12px; line-height:1.5;">If you were not expecting this invitation, you can ignore this email.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      HTML
    end
  end
end
