import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

/**
 * EmailScheduler: runs the IMAP email fetch on a configurable interval.
 * Default: every 5 minutes. Set EMAIL_CHECK_INTERVAL_MINUTES in .env.
 */
@Injectable()
export class EmailScheduler {
  private readonly logger = new Logger(EmailScheduler.name);
  private isRunning = false; // prevent overlapping runs

  constructor(
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  // Runs every 5 minutes (configurable via cron expression in env)
  @Cron('*/5 * * * *', { name: 'email-fetch' })
  async handleEmailFetch(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Email fetch already running, skipping this cycle');
      return;
    }

    // Skip if Gmail credentials not configured
    if (!this.config.get('GMAIL_USER') || !this.config.get('GMAIL_APP_PASSWORD')) {
      return;
    }

    this.isRunning = true;
    try {
      const result = await this.emailService.fetchAndProcessEmails();
      if (result.processed > 0 || result.skipped > 0) {
        this.logger.log(
          `Email fetch complete: ${result.processed} processados, ${result.skipped} ignorados`,
        );
      }
    } catch (error) {
      this.logger.error(`Email fetch failed: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
