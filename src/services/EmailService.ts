// ═══════════════════════════════════════════════════════════════
// Email Service
// Handles all transactional emails for the subscription system
// ═══════════════════════════════════════════════════════════════

import * as nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  /**
   * Send email helper
   */
  private async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'HaliSoft <noreply@halisoft.com>',
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });

      logger.info('Email sent', { to: params.to, subject: params.subject });
    } catch (error: any) {
      logger.error('Failed to send email', {
        to: params.to,
        error: error.message,
      });
    }
  }

  /**
   * Get user email
   */
  private async getUserEmail(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user.email;
  }

  /**
   * Send welcome email after subscription activation
   */
  async sendWelcomeEmail(userId: string, planName: string): Promise<void> {
    const email = await this.getUserEmail(userId);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to HaliSoft!</h1>
          </div>
          <div class="content">
            <h2>Your ${planName} subscription is now active</h2>
            <p>Thank you for subscribing to HaliSoft. You now have access to our powerful AI components for factoring and invoice analysis.</p>

            <p><strong>What's included in your plan:</strong></p>
            <ul>
              <li>AI-powered invoice OCR and analysis</li>
              <li>Advanced risk assessment tools</li>
              <li>Document processing and KYC verification</li>
              <li>Real-time financial analytics</li>
            </ul>

            <a href="${process.env.APP_URL}/dashboard" class="button">Go to Dashboard</a>

            <p>If you have any questions, our support team is here to help.</p>
          </div>
          <div class="footer">
            <p>HaliSoft - AI-Powered Factoring Platform</p>
            <p><a href="${process.env.APP_URL}/support">Contact Support</a> | <a href="${process.env.APP_URL}/docs">Documentation</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: `Welcome to HaliSoft - ${planName} Plan`,
      html,
    });
  }

  /**
   * Send quota warning email (80% or 90% usage)
   */
  async sendQuotaWarningEmail(
    userId: string,
    componentName: string,
    used: number,
    limit: number,
    percentage: number
  ): Promise<void> {
    const email = await this.getUserEmail(userId);

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #F59E0B;">⚠️ Quota Warning</h2>
          <p>You've used <strong>${percentage}%</strong> of your monthly quota for <strong>${componentName}</strong>.</p>

          <div style="background: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0;">
            <p style="margin: 0;"><strong>Current usage:</strong> ${used} / ${limit}</p>
          </div>

          <p>Consider upgrading your plan to avoid service interruption.</p>

          <a href="${process.env.APP_URL}/pricing" style="display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            View Plans
          </a>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: `HaliSoft - Quota Warning (${percentage}% used)`,
      html,
    });
  }

  /**
   * Send quota exceeded email
   */
  async sendQuotaExceededEmail(
    userId: string,
    componentName: string,
    used: number,
    limit: number
  ): Promise<void> {
    const email = await this.getUserEmail(userId);

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #DC2626;">🚫 Quota Exceeded</h2>
          <p>You've reached your monthly quota for <strong>${componentName}</strong>.</p>

          <div style="background: #FEE2E2; padding: 15px; border-left: 4px solid #DC2626; margin: 20px 0;">
            <p style="margin: 0;"><strong>Limit reached:</strong> ${used} / ${limit}</p>
            <p style="margin: 10px 0 0 0;">Further requests will be blocked until your quota resets.</p>
          </div>

          <p><strong>What you can do:</strong></p>
          <ul>
            <li>Upgrade to a higher plan for increased limits</li>
            <li>Wait for your quota to reset at the start of your next billing period</li>
          </ul>

          <a href="${process.env.APP_URL}/pricing" style="display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Upgrade Plan
          </a>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'HaliSoft - Quota Exceeded',
      html,
    });
  }

  /**
   * Send monthly usage report
   */
  async sendMonthlyUsageReport(
    userId: string,
    usageData: Record<string, { used: number; limit: number | null }>
  ): Promise<void> {
    const email = await this.getUserEmail(userId);

    const usageRows = Object.entries(usageData)
      .map(
        ([component, data]) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;">${component}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: right;">${data.used}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; text-align: right;">${data.limit || 'Unlimited'}</td>
        </tr>
      `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>📊 Monthly Usage Report</h2>
          <p>Here's a summary of your AI component usage for the past month:</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #F3F4F6;">
                <th style="padding: 10px; text-align: left;">Component</th>
                <th style="padding: 10px; text-align: right;">Used</th>
                <th style="padding: 10px; text-align: right;">Limit</th>
              </tr>
            </thead>
            <tbody>
              ${usageRows}
            </tbody>
          </table>

          <p>Your quotas have been reset for the new billing period.</p>

          <a href="${process.env.APP_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            View Dashboard
          </a>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'HaliSoft - Monthly Usage Report',
      html,
    });
  }

  /**
   * Send payment receipt
   */
  async sendPaymentReceipt(
    userId: string,
    amount: number,
    planName: string
  ): Promise<void> {
    const email = await this.getUserEmail(userId);

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>✅ Payment Received</h2>
          <p>Thank you for your payment!</p>

          <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Plan:</strong> ${planName}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> $${amount.toFixed(2)}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>

          <p>Your subscription has been renewed and quotas have been reset.</p>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'HaliSoft - Payment Receipt',
      html,
    });
  }

  /**
   * Send payment failed notification
   */
  async sendPaymentFailedEmail(userId: string): Promise<void> {
    const email = await this.getUserEmail(userId);

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #DC2626;">❌ Payment Failed</h2>
          <p>We were unable to process your recent payment.</p>

          <div style="background: #FEE2E2; padding: 15px; border-left: 4px solid #DC2626; margin: 20px 0;">
            <p style="margin: 0;">Your subscription may be suspended if payment is not received.</p>
          </div>

          <p><strong>What to do next:</strong></p>
          <ul>
            <li>Check that your payment method is valid and has sufficient funds</li>
            <li>Update your payment method in your account settings</li>
            <li>Contact our support team if you need assistance</li>
          </ul>

          <a href="${process.env.APP_URL}/settings/billing" style="display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Update Payment Method
          </a>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'HaliSoft - Payment Failed',
      html,
    });
  }

  /**
   * Send cancellation confirmation
   */
  async sendCancellationEmail(
    userId: string,
    planName: string,
    immediate: boolean
  ): Promise<void> {
    const email = await this.getUserEmail(userId);

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Subscription Cancelled</h2>
          <p>Your ${planName} subscription has been cancelled.</p>

          ${
            immediate
              ? '<p><strong>Your access has been terminated immediately.</strong></p>'
              : '<p>You will continue to have access until the end of your current billing period.</p>'
          }

          <p>We're sorry to see you go. If you have any feedback about your experience, we'd love to hear it.</p>

          <a href="${process.env.APP_URL}/feedback" style="display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Share Feedback
          </a>

          <p>You can reactivate your subscription at any time by visiting our pricing page.</p>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'HaliSoft - Subscription Cancelled',
      html,
    });
  }
}

export const emailService = new EmailService();
