"""
Email Notification Service for TankWise Refill Orders
Sends formatted HTML emails via SMTP (Gmail / Custom SMTP)
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
from ..config import get_settings

logger = logging.getLogger(__name__)

def send_refill_order_email(
    to_email: str,
    vendor_name: str,
    tank_name: str,
    tank_location: str,
    liters_ordered: float,
    cost: float,
    current_level_pct: float,
    customer_name: str,
    notes: str = "",
    order_id: str = "",
) -> bool:
    """
    Sends an automated HTML email alert to the vendor when a refill order is placed.
    """
    settings = get_settings()

    if not settings.smtp_user or not settings.smtp_pass:
        logger.warning("SMTP credentials not configured. Skipping email delivery.")
        return False

    recipient = to_email if to_email else settings.smtp_user

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"🚨 Water Tanker Refill Request: {tank_name} ({int(liters_ordered)} Litres)"
    msg["From"] = f"{settings.from_name} <{settings.smtp_from or settings.smtp_user}>"
    msg["To"] = recipient

    # HTML Body
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 24px; color: #f8fafc; }}
        .card {{ background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; max-width: 580px; margin: 0 auto; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }}
        .header {{ background: linear-gradient(135deg, #06b6d4, #3b82f6); padding: 24px; text-align: center; color: #020617; }}
        .header h1 {{ margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }}
        .content {{ padding: 24px; }}
        .greeting {{ font-size: 16px; margin-bottom: 16px; color: #e2e8f0; }}
        .badge {{ display: inline-block; background-color: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.3); color: #22d3ee; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; }}
        .table-box {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        .table-box td {{ padding: 12px; border-bottom: 1px solid #334155; font-size: 14px; }}
        .table-box td.label {{ color: #94a3b8; font-weight: 600; width: 40%; }}
        .table-box td.val {{ color: #ffffff; font-weight: 700; }}
        .highlight {{ color: #22d3ee; font-size: 18px; }}
        .notes-box {{ background-color: #0f172a; border-left: 4px solid #06b6d4; padding: 12px 16px; border-radius: 4px; margin: 16px 0; font-size: 13px; color: #cbd5e1; }}
        .footer {{ padding: 16px 24px; background-color: #0f172a; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>💧 TankWise Automated Refill Dispatch</h1>
          <p style="margin: 4px 0 0; font-size: 13px; font-weight: 600;">Immediate Water Delivery Required</p>
        </div>
        <div class="content">
          <div class="greeting">
            Hello <strong>{vendor_name}</strong>,
          </div>
          <p style="font-size: 14px; color: #94a3b8; line-height: 1.5;">
            An automated water tanker replenishment order has been placed by <strong>{customer_name}</strong>. Please dispatch a water tanker per details below:
          </p>
          
          <table class="table-box">
            <tr>
              <td class="label">Target Tank:</td>
              <td class="val">{tank_name}</td>
            </tr>
            <tr>
              <td class="label">Delivery Location:</td>
              <td class="val">{tank_location or 'Main Residential Block'}</td>
            </tr>
            <tr>
              <td class="label">Quantity Ordered:</td>
              <td class="val highlight">{int(liters_ordered):,} Litres</td>
            </tr>
            <tr>
              <td class="label">Agreed Trip Cost:</td>
              <td class="val" style="color: #34d399;">₹{cost:,.2f}</td>
            </tr>
            <tr>
              <td class="label">Current Tank Level:</td>
              <td class="val" style="color: #f87171;">{round(current_level_pct, 1)}% (Low Reserve)</td>
            </tr>
            {f'<tr><td class="label">Order Ref ID:</td><td class="val" style="font-family: monospace;">#{order_id[:8]}</td></tr>' if order_id else ''}
          </table>

          {f'<div class="notes-box"><strong>Delivery Note:</strong> {notes}</div>' if notes else ''}

          <p style="font-size: 13px; color: #94a3b8; margin-top: 20px;">
            The IoT water level sensors are actively tracking tank levels and will automatically verify delivery once pumping commences.
          </p>
        </div>
        <div class="footer">
          Automated Message sent by TankWise Water Usage Intelligence System &copy; 2026.
        </div>
      </div>
    </body>
    </html>
    """

    msg.attach(MIMEText(html_content, "html"))

    try:
        logger.info("Connecting to SMTP host %s:%s to send order email to %s...", settings.smtp_host, settings.smtp_port, recipient)
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10.0) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.smtp_user, settings.smtp_pass)
            server.send_message(msg)
        logger.info("Successfully dispatched refill order email to %s", recipient)
        return True
    except Exception as e:
        logger.error("Failed to send refill order email: %s", e)
        return False


def send_password_reset_email(to_email: str, otp_code: str, user_name: str = "User") -> bool:
    """
    Sends a 6-digit Password Reset OTP email to the user.
    """
    settings = get_settings()
    if not settings.smtp_user or not settings.smtp_pass:
        logger.warning("SMTP credentials not configured. Skipping password reset email.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"🔐 Your TankWise Password Reset Code: {otp_code}"
    msg["From"] = f"{settings.from_name} <{settings.smtp_from or settings.smtp_user}>"
    msg["To"] = to_email

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; margin: 0; padding: 24px; color: #f8fafc; }}
        .card {{ background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; max-width: 500px; margin: 0 auto; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #6366f1, #818cf8); padding: 24px; text-align: center; color: #ffffff; }}
        .content {{ padding: 24px; text-align: center; }}
        .otp-box {{ display: inline-block; background-color: #0f172a; border: 2px dashed #6366f1; color: #a5b4fc; font-size: 32px; font-weight: 800; letter-spacing: 6px; padding: 12px 24px; border-radius: 12px; margin: 20px 0; font-family: monospace; }}
        .footer {{ padding: 16px; background-color: #0f172a; font-size: 11px; color: #64748b; border-top: 1px solid #334155; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h2 style="margin: 0;">🔐 Password Reset Request</h2>
        </div>
        <div class="content">
          <p style="color: #cbd5e1; font-size: 14px;">Hello <strong>{user_name}</strong>,</p>
          <p style="color: #94a3b8; font-size: 13px;">Use the following 6-digit verification code to reset your TankWise account password:</p>
          <div class="otp-box">{otp_code}</div>
          <p style="color: #94a3b8; font-size: 12px;">This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>
        </div>
        <div class="footer">
          TankWise Water Usage Intelligence Platform &copy; 2026
        </div>
      </div>
    </body>
    </html>
    """

    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10.0) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.smtp_user, settings.smtp_pass)
            server.send_message(msg)
        logger.info("Successfully sent password reset OTP to %s", to_email)
        return True
    except Exception as e:
        logger.error("Failed to send password reset email: %s", e)
        return False
