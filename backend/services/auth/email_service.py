"""
Email service for sending verification and notification emails
"""

import os
from typing import Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib


class EmailService:
    """Service for sending emails"""

    def __init__(self):
        self.smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        self.smtp_user = os.environ.get("SMTP_USER", "")
        self.smtp_password = os.environ.get("SMTP_PASSWORD", "")
        self.from_email = os.environ.get("FROM_EMAIL", "noreply@interface.app")
        self.from_name = os.environ.get("FROM_NAME", "Interface")
        self.app_url = os.environ.get("APP_URL", "http://localhost:3000")

    def _send_email(self, to_email: str, subject: str, html_content: str, text_content: str = "") -> bool:
        """Send an email"""
        if not self.smtp_user or not self.smtp_password:
            # In development, just log the email
            print(f"[EMAIL] To: {to_email}")
            print(f"[EMAIL] Subject: {subject}")
            print(f"[EMAIL] Content: {text_content or html_content[:200]}")
            return True

        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email

            if text_content:
                msg.attach(MIMEText(text_content, 'plain'))
            msg.attach(MIMEText(html_content, 'html'))

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)

            return True
        except Exception as e:
            print(f"Failed to send email: {e}")
            return False

    def send_verification_email(self, email: str, name: str, token: str) -> bool:
        """Send email verification email"""
        verification_url = f"{self.app_url}/verify-email?token={token}"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ display: inline-block; background: #0ea5e9; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; }}
                .footer {{ text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to Interface</h1>
                </div>
                <div class="content">
                    <p>Hi {name},</p>
                    <p>Thanks for signing up! Please verify your email address to get started.</p>
                    <p style="text-align: center;">
                        <a href="{verification_url}" class="button">Verify Email Address</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #64748b; font-size: 14px;">{verification_url}</p>
                    <p>This link will expire in 24 hours.</p>
                </div>
                <div class="footer">
                    <p>Interface - Transform your workforce planning</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_content = f"""
        Hi {name},

        Thanks for signing up for Interface!

        Please verify your email address by clicking this link:
        {verification_url}

        This link will expire in 24 hours.

        Best,
        The Interface Team
        """

        return self._send_email(email, "Verify your email - Interface", html_content, text_content)

    def send_password_reset_email(self, email: str, name: str, token: str) -> bool:
        """Send password reset email"""
        reset_url = f"{self.app_url}/reset-password?token={token}"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ display: inline-block; background: #0ea5e9; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; }}
                .footer {{ text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Password Reset</h1>
                </div>
                <div class="content">
                    <p>Hi {name},</p>
                    <p>We received a request to reset your password. Click the button below to create a new password.</p>
                    <p style="text-align: center;">
                        <a href="{reset_url}" class="button">Reset Password</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #64748b; font-size: 14px;">{reset_url}</p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request this, you can safely ignore this email.</p>
                </div>
                <div class="footer">
                    <p>Interface - Transform your workforce planning</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_content = f"""
        Hi {name},

        We received a request to reset your password.

        Click this link to create a new password:
        {reset_url}

        This link will expire in 1 hour.

        If you didn't request this, you can safely ignore this email.

        Best,
        The Interface Team
        """

        return self._send_email(email, "Reset your password - Interface", html_content, text_content)

    def send_welcome_email(self, email: str, name: str, organization_name: Optional[str] = None) -> bool:
        """Send welcome email after successful onboarding"""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ display: inline-block; background: #0ea5e9; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; }}
                .feature {{ display: flex; align-items: center; margin: 15px 0; }}
                .feature-icon {{ width: 40px; height: 40px; background: #e0f2fe; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 15px; }}
                .footer {{ text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to Interface!</h1>
                </div>
                <div class="content">
                    <p>Hi {name},</p>
                    <p>Your account{f' for {organization_name}' if organization_name else ''} is all set up and ready to go!</p>

                    <h3>Get started with these features:</h3>

                    <div class="feature">
                        <div class="feature-icon">📊</div>
                        <div>
                            <strong>Dashboard</strong><br>
                            <span style="color: #64748b;">View real-time workforce metrics</span>
                        </div>
                    </div>

                    <div class="feature">
                        <div class="feature-icon">📈</div>
                        <div>
                            <strong>Workforce Planning</strong><br>
                            <span style="color: #64748b;">Plan headcount and track actuals</span>
                        </div>
                    </div>

                    <div class="feature">
                        <div class="feature-icon">🔗</div>
                        <div>
                            <strong>Integrations</strong><br>
                            <span style="color: #64748b;">Connect your HRIS and ATS systems</span>
                        </div>
                    </div>

                    <p style="text-align: center;">
                        <a href="{self.app_url}/app/dashboard" class="button">Go to Dashboard</a>
                    </p>

                    <p>Need help? Check out our <a href="#">documentation</a> or reply to this email.</p>
                </div>
                <div class="footer">
                    <p>Interface - Transform your workforce planning</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_content = f"""
        Hi {name},

        Welcome to Interface!

        Your account{f' for {organization_name}' if organization_name else ''} is all set up.

        Get started with:
        - Dashboard: View real-time workforce metrics
        - Workforce Planning: Plan headcount and track actuals
        - Integrations: Connect your HRIS and ATS systems

        Go to your dashboard: {self.app_url}/app/dashboard

        Need help? Reply to this email.

        Best,
        The Interface Team
        """

        return self._send_email(email, "Welcome to Interface!", html_content, text_content)

    def send_team_invite_email(self, email: str, inviter_name: str, organization_name: str, invite_token: str) -> bool:
        """Send team invitation email"""
        invite_url = f"{self.app_url}/accept-invite?token={invite_token}"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ display: inline-block; background: #0ea5e9; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; }}
                .footer {{ text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>You're Invited!</h1>
                </div>
                <div class="content">
                    <p>{inviter_name} has invited you to join <strong>{organization_name}</strong> on Interface.</p>
                    <p>Click the button below to accept the invitation and create your account.</p>
                    <p style="text-align: center;">
                        <a href="{invite_url}" class="button">Accept Invitation</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #64748b; font-size: 14px;">{invite_url}</p>
                    <p>This invitation will expire in 7 days.</p>
                </div>
                <div class="footer">
                    <p>Interface - Transform your workforce planning</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_content = f"""
        You're Invited!

        {inviter_name} has invited you to join {organization_name} on Interface.

        Accept the invitation by clicking this link:
        {invite_url}

        This invitation will expire in 7 days.

        Best,
        The Interface Team
        """

        return self._send_email(email, f"You're invited to join {organization_name}", html_content, text_content)
