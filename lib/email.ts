// Transactional email for the auth flows (address verification and password
// reset). Talks to the Resend REST API directly rather than pulling in the SDK
// - it is two fields and one POST, and it keeps the dependency list short.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type SendEmailOptions = {
  to: string;
  subject: string;
  /** Plain-text body. Always sent, so the mail is readable in any client. */
  text: string;
  html: string;
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail({ to, subject, text, html }: SendEmailOptions) {
  if (!isEmailConfigured()) {
    // Without a provider there is no way to deliver the link, and silently
    // resolving would leave the user waiting for a mail that never arrives.
    // In development the link is worth more in the terminal than as an error,
    // so print it and carry on; in production this has to fail loudly.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Email is not configured: set RESEND_API_KEY and EMAIL_FROM",
      );
    }
    console.warn(
      `\n[email] RESEND_API_KEY/EMAIL_FROM unset - not sending.\n[email] to: ${to}\n[email] subject: ${subject}\n[email] ${text}\n`,
    );
    return;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    // The body carries Resend's reason (unverified domain, bad key, ...), which
    // is what makes a failure diagnosable in the Vercel logs.
    const detail = await response.text().catch(() => "");
    throw new Error(`Failed to send email (${response.status}): ${detail}`);
  }
}

/**
 * One shared shell for both auth mails, so they stay visually consistent and
 * there is a single place to change the wording or colours. Deliberately plain
 * inline-styled HTML: mail clients strip anything cleverer.
 */
function emailTemplate(opts: {
  heading: string;
  body: string;
  buttonLabel: string;
  url: string;
  footer: string;
}) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#eff1f5;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#4c4f69;">
    <table role="presentation" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 16px;font-size:20px;color:#4c4f69;">${opts.heading}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#5c5f77;">${opts.body}</p>
        <a href="${opts.url}" style="display:inline-block;padding:12px 20px;background:#1e66f5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:500;">${opts.buttonLabel}</a>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6c6f85;">${opts.footer}</p>
        <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#8c8fa1;word-break:break-all;">Or paste this link into your browser:<br />${opts.url}</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function verificationEmail(url: string) {
  return {
    subject: "Verify your email for Stellar",
    text: `Confirm your email address to finish setting up your Stellar account:\n\n${url}\n\nIf you didn't create a Stellar account, you can ignore this email.`,
    html: emailTemplate({
      heading: "Verify your email",
      body: "Confirm your email address to finish setting up your Stellar account.",
      buttonLabel: "Verify email",
      url,
      footer:
        "If you didn't create a Stellar account, you can ignore this email.",
    }),
  };
}

export function resetPasswordEmail(url: string) {
  return {
    subject: "Reset your Stellar password",
    text: `Choose a new password for your Stellar account:\n\n${url}\n\nThis link expires in one hour. If you didn't ask to reset your password, you can ignore this email - your password stays unchanged.`,
    html: emailTemplate({
      heading: "Reset your password",
      body: "Choose a new password for your Stellar account. This link expires in one hour.",
      buttonLabel: "Reset password",
      url,
      footer:
        "If you didn't ask to reset your password, you can ignore this email - your password stays unchanged.",
    }),
  };
}
