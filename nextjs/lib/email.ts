import { Resend } from 'resend';

// ---------------------------------------------------------------------------
// Resend email client — graceful fallback if API key not configured
// ---------------------------------------------------------------------------

let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not configured — emails will not be sent.');
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// ---------------------------------------------------------------------------
// Send password reset email
// ---------------------------------------------------------------------------

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const client = getResendClient();

  if (!client) {
    // Graceful fallback: log the link for local development
    console.warn(`[Email] Password reset link for ${email}: ${resetUrl}`);
    return;
  }

  const { error } = await client.emails.send({
    from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
    to: email,
    subject: 'Reset your vBudget password',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Reset your password</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.06);overflow:hidden;">
                <!-- Header -->
                <tr>
                  <td style="background-color:#020617;padding:32px 40px;text-align:center;">
                    <div style="width:48px;height:48px;border-radius:50%;background-color:#6366f1;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
                      <span style="color:#ffffff;font-size:18px;font-weight:bold;line-height:48px;display:block;">vB</span>
                    </div>
                    <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">vBudget</h1>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px;">
                    <h2 style="color:#0f172a;font-size:20px;font-weight:600;margin:0 0 12px 0;">Reset your password</h2>
                    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
                      We received a request to reset the password for your vBudget account. Click the button below to choose a new password.
                    </p>
                    <div style="text-align:center;margin:32px 0;">
                      <a
                        href="${resetUrl}"
                        style="display:inline-block;background-color:#6366f1;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;"
                      >
                        Reset Password
                      </a>
                    </div>
                    <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px 0;">
                      This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your password will not change.
                    </p>
                    <p style="color:#94a3b8;font-size:12px;margin:16px 0 0 0;word-break:break-all;">
                      Or copy this link into your browser:<br />
                      <a href="${resetUrl}" style="color:#6366f1;">${resetUrl}</a>
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
                    <p style="color:#94a3b8;font-size:12px;margin:0;">vBudget · Expense Tracker</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error('[Email] Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}

// ---------------------------------------------------------------------------
// Send email verification email
// ---------------------------------------------------------------------------

export async function sendVerificationEmail(email: string, verifyUrl: string): Promise<void> {
  const client = getResendClient();

  if (!client) {
    console.warn(`[Email] Verification link for ${email}: ${verifyUrl}`);
    return;
  }

  const { error } = await client.emails.send({
    from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
    to: email,
    subject: 'Verify your vBudget email',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Verify your email</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.06);overflow:hidden;">
                <!-- Header -->
                <tr>
                  <td style="background-color:#020617;padding:32px 40px;text-align:center;">
                    <div style="width:48px;height:48px;border-radius:50%;background-color:#6366f1;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
                      <span style="color:#ffffff;font-size:18px;font-weight:bold;line-height:48px;display:block;">vB</span>
                    </div>
                    <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">vBudget</h1>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px;">
                    <h2 style="color:#0f172a;font-size:20px;font-weight:600;margin:0 0 12px 0;">Verify your email</h2>
                    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
                      Thanks for signing up for vBudget! Please verify your email address by clicking the button below.
                    </p>
                    <div style="text-align:center;margin:32px 0;">
                      <a
                        href="${verifyUrl}"
                        style="display:inline-block;background-color:#6366f1;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;"
                      >
                        Verify Email
                      </a>
                    </div>
                    <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px 0;">
                      This link expires in <strong>24 hours</strong>. If you did not create an account, you can safely ignore this email.
                    </p>
                    <p style="color:#94a3b8;font-size:12px;margin:16px 0 0 0;word-break:break-all;">
                      Or copy this link into your browser:<br />
                      <a href="${verifyUrl}" style="color:#6366f1;">${verifyUrl}</a>
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
                    <p style="color:#94a3b8;font-size:12px;margin:0;">vBudget · Expense Tracker</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error('[Email] Failed to send verification email:', error);
    throw new Error('Failed to send verification email');
  }
}

// ---------------------------------------------------------------------------
// Send project invitation email
// ---------------------------------------------------------------------------

export async function sendInvitationEmail(
  email: string,
  inviteUrl: string,
  inviterEmail: string,
  projectName: string,
  message?: string | null
): Promise<void> {
  const client = getResendClient();

  if (!client) {
    console.warn(`[Email] Invitation link for ${email}: ${inviteUrl}`);
    return;
  }

  const messageBlock = message
    ? `<div style="background-color:#f1f5f9;border-radius:8px;padding:16px;margin:0 0 24px 0;">
         <p style="color:#334155;font-size:14px;font-style:italic;line-height:1.6;margin:0;">&ldquo;${message}&rdquo;</p>
         <p style="color:#64748b;font-size:13px;margin:8px 0 0 0;">&mdash; ${inviterEmail}</p>
       </div>`
    : '';

  const { error } = await client.emails.send({
    from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
    to: email,
    subject: `You're invited to join "${projectName}" on vBudget`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Project Invitation</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.06);overflow:hidden;">
                <!-- Header -->
                <tr>
                  <td style="background-color:#020617;padding:32px 40px;text-align:center;">
                    <div style="width:48px;height:48px;border-radius:50%;background-color:#6366f1;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
                      <span style="color:#ffffff;font-size:18px;font-weight:bold;line-height:48px;display:block;">vB</span>
                    </div>
                    <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">vBudget</h1>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px;">
                    <h2 style="color:#0f172a;font-size:20px;font-weight:600;margin:0 0 12px 0;">You&rsquo;re invited!</h2>
                    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
                      <strong>${inviterEmail}</strong> has invited you to join the project <strong>&ldquo;${projectName}&rdquo;</strong> on vBudget.
                    </p>
                    ${messageBlock}
                    <div style="text-align:center;margin:32px 0;">
                      <a
                        href="${inviteUrl}"
                        style="display:inline-block;background-color:#6366f1;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;"
                      >
                        Accept Invitation
                      </a>
                    </div>
                    <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px 0;">
                      This link expires in <strong>7 days</strong>. If you did not expect this invitation, you can safely ignore this email.
                    </p>
                    <p style="color:#94a3b8;font-size:12px;margin:16px 0 0 0;word-break:break-all;">
                      Or copy this link into your browser:<br />
                      <a href="${inviteUrl}" style="color:#6366f1;">${inviteUrl}</a>
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
                    <p style="color:#94a3b8;font-size:12px;margin:0;">vBudget &middot; Expense Tracker</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error('[Email] Failed to send invitation email:', error);
    throw new Error('Failed to send invitation email');
  }
}
