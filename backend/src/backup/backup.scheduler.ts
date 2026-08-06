// backup.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { BackupService } from './backup.service';

@Injectable()
export class BackupScheduler {
  private readonly logger = new Logger(BackupScheduler.name);

  constructor(
    private readonly backupService: BackupService,
    private readonly config: ConfigService,
  ) {}

  // Daily at 02:00 AM — configurable via BACKUP_CRON env var
  @Cron('0 2 * * *', { name: 'daily-backup' })
  async handleDailyBackup(): Promise<void> {
    this.logger.log('🕑 Iniciando backup diário automático...');
    try {
      const result = await this.backupService.runFullBackup();
      this.logger.log(`✅ Backup diário concluído: job #${result.jobId} — ${result.file}`);
    } catch (error) {
      this.logger.error(`❌ Backup diário falhou: ${error.message}`);
    }
  }
}
