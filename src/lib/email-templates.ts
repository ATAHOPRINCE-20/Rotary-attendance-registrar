/**
 * Rotary Connect — Premium Email Templates System
 * Responsive, modern, mobile-friendly HTML email templates.
 */

interface BaseEmailOptions {
  orgName?: string;
  logoUrl?: string;
}

interface MemberInviteOptions extends BaseEmailOptions {
  fullName: string;
  actionLink: string;
}

interface RegistrationReceiptOptions extends BaseEmailOptions {
  fullName: string;
  eventTitle: string;
  eventDate?: string;
  eventVenue?: string;
  qrRef: string;
}

interface GeneralCommsOptions extends BaseEmailOptions {
  fullName?: string;
  subject: string;
  messageContent: string;
  actionUrl?: string;
  actionText?: string;
}

/**
 * Base Wrapper Container for consistent email styling
 */
function wrapEmailBody(contentHtml: string, orgName = "Rotary Club"): string {
  const currentYear = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Encoding" content="IE=edge">
  <title>${orgName}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f6fb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b; line-height: 1.6; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    td { padding: 0; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f4f6fb; padding: 30px 10px; }
    .main-card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(10, 25, 47, 0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0A192F 0%, #17458F 100%); padding: 36px 24px; text-align: center; }
    .logo-badge { display: inline-block; background-color: #F7A81B; color: #0A192F; width: 48px; height: 48px; line-height: 48px; border-radius: 14px; font-weight: 900; font-size: 22px; text-align: center; margin-bottom: 12px; box-shadow: 0 4px 10px rgba(247, 168, 27, 0.3); }
    .header-title { color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: -0.3px; margin: 0; }
    .header-subtitle { color: #F7A81B; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }
    .content { padding: 36px 32px; background-color: #ffffff; }
    h1 { color: #0A192F; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 16px; }
    p { color: #475569; font-size: 15px; margin-top: 0; margin-bottom: 20px; line-height: 1.6; }
    .info-box { background-color: #f8fafc; border-left: 4px solid #17458F; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .info-box-gold { background-color: #fffbeb; border-left: 4px solid #F7A81B; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .btn-container { text-align: center; margin: 32px 0 24px 0; }
    .btn { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #F7A81B 0%, #e09412 100%); color: #0A192F !important; font-weight: 800; font-size: 14px; text-decoration: none; border-radius: 14px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 6px 16px rgba(247, 168, 27, 0.35); transition: all 0.2s ease; }
    .link-alt { font-size: 12px; color: #64748b; word-break: break-all; text-align: center; margin-top: 16px; }
    .footer { background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
    .footer-org { color: #17458F; font-weight: 700; }
    @media only screen and (max-width: 600px) {
      .content { padding: 28px 20px !important; }
      .header { padding: 28px 16px !important; }
      .btn { display: block !important; width: 100% !important; box-sizing: border-box !important; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main-card">
      <div class="header">
        <div class="logo-badge">⚙</div>
        <h2 class="header-title">${orgName}</h2>
        <div class="header-subtitle">Service Above Self</div>
      </div>
      <div class="content">
        ${contentHtml}
      </div>
      <div class="footer">
        Sent by <span class="footer-org">${orgName}</span><br>
        Powered by Agoroll Platform &bull; &copy; ${currentYear} All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 1. Member Portal Invitation Email Template
 */
export function getMemberInviteEmailTemplate(options: MemberInviteOptions): string {
  const orgName = options.orgName || "Rotary Club";
  const body = `
    <h1>Welcome to your Member Portal!</h1>
    <p>Dear <strong>${options.fullName}</strong>,</p>
    <p>You have been registered as an active member of <strong>${orgName}</strong>.</p>
    <p>Your Member Portal provides instant digital access to your statement of accounts, dues payments (Happy Shillings, Polio Plus, TRF), attendance registers, and club notifications.</p>

    <div class="info-box-gold">
      <strong style="color: #92400e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Account Activation Required</strong>
      <p style="margin: 6px 0 0 0; color: #78350f; font-size: 14px;">
        Click the button below to set up your password and activate your account.
      </p>
    </div>

    <div class="btn-container">
      <a href="${options.actionLink}" class="btn">Activate My Account</a>
    </div>

    <div class="link-alt">
      If the button above does not work, copy and paste this link into your browser:<br>
      <a href="${options.actionLink}" style="color: #17458F;">${options.actionLink}</a>
    </div>
  `;
  return wrapEmailBody(body, orgName);
}

/**
 * 2. Event Registration Receipt / Ticket Email Template
 */
export function getRegistrationReceiptEmailTemplate(options: RegistrationReceiptOptions): string {
  const orgName = options.orgName || "Rotary Club";
  const body = `
    <h1>Registration Confirmed! 🎉</h1>
    <p>Dear <strong>${options.fullName}</strong>,</p>
    <p>Thank you for registering for <strong>${options.eventTitle}</strong> organized by <strong>${orgName}</strong>.</p>

    <div class="info-box">
      <table style="width: 100%;">
        <tr>
          <td style="padding-bottom: 10px; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Event Details</td>
        </tr>
        <tr>
          <td style="font-size: 16px; font-weight: 800; color: #0A192F; padding-bottom: 4px;">${options.eventTitle}</td>
        </tr>
        ${options.eventDate ? `<tr><td style="font-size: 14px; color: #475569; padding-bottom: 2px;">📅 ${options.eventDate}</td></tr>` : ""}
        ${options.eventVenue ? `<tr><td style="font-size: 14px; color: #475569; padding-bottom: 8px;">📍 ${options.eventVenue}</td></tr>` : ""}
        <tr>
          <td style="padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 14px; font-weight: 700; color: #17458F;">
            Ticket Ref Code: <span style="font-family: monospace; font-size: 18px; color: #F7A81B; letter-spacing: 2px;">${options.qrRef}</span>
          </td>
        </tr>
      </table>
    </div>

    <p style="text-align: center; font-size: 14px; color: #64748b;">
      Please present this reference code or your name at the event check-in desk upon arrival.
    </p>
  `;
  return wrapEmailBody(body, orgName);
}

/**
 * 3. General Club Communication / Announcement Email Template
 */
export function getGeneralCommsEmailTemplate(options: GeneralCommsOptions): string {
  const orgName = options.orgName || "Rotary Club";
  const recipient = options.fullName ? `Dear <strong>${options.fullName}</strong>,` : "Greetings,";
  const body = `
    <h1>${options.subject}</h1>
    <p>${recipient}</p>
    <div style="font-size: 15px; color: #334155; line-height: 1.7; margin-bottom: 24px;">
      ${options.messageContent}
    </div>

    ${options.actionUrl && options.actionText ? `
      <div class="btn-container">
        <a href="${options.actionUrl}" class="btn">${options.actionText}</a>
      </div>
    ` : ""}
  `;
  return wrapEmailBody(body, orgName);
}
