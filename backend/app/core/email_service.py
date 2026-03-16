import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_verification_email(to_email: str, token: str) -> None:
    if not settings.mail_enabled:
        logger.warning("Email not configured — skipping verification email to %s. Set MAIL_USER and MAIL_PASSWORD.", to_email)
        return

    verify_url = f"{settings.app_url}/verify-email?token={token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your Budget account"
    msg["From"] = settings.mail_user
    msg["To"] = to_email

    text = f"Verify your Budget account by visiting: {verify_url}\n\nThis link expires in 24 hours."
    html = f"""
    <html>
    <body style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #6366f1;">💰 Budget — Verify your email</h2>
      <p>Click the button below to verify your email address and activate your account.</p>
      <a href="{verify_url}"
         style="display:inline-block;background:#6366f1;color:white;padding:12px 28px;
                border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
        Verify Email
      </a>
      <p style="color:#6b7280;font-size:13px;">This link expires in 24 hours.<br>
      If you didn't create an account, you can safely ignore this email.</p>
    </body>
    </html>
    """

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(settings.mail_host, settings.mail_port) as server:
        server.starttls()
        server.login(settings.mail_user, settings.mail_password)
        server.sendmail(settings.mail_user, to_email, msg.as_string())

    logger.info("Verification email sent to %s", to_email)
