import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../config/database.service';
import * as archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';
import * as dayjs from 'dayjs';

function normalize(row: any): any {
  if (!row) return null;
  const result: any = {};
  for (const key of Object.keys(row)) {
    result[key.toLowerCase()] = row[key];
  }
  return result;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupPath: string;
  private readonly storagePath: string;

  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
  ) {
    this.backupPath  = config.get<string>('BACKUP_PATH', './backups');
    this.storagePath = config.get<string>('STORAGE_PATH', './storage');
    this.ensureDir(this.backupPath);
  }

  async runFullBackup(): Promise<{ jobId: number; file: string }> {
    const jobId = await this.createJob('full');
    await this.updateJob(jobId, 'RUNNING');

    try {
      const ts    = dayjs().format('YYYYMMDD_HHmmss');
      const fname = `backup_full_${ts}.zip`;
      const fpath = path.join(this.backupPath, fname);

      await this.createZip(fpath, async (archive) => {
        if (fs.existsSync(this.storagePath)) {
          archive.directory(this.storagePath, 'storage');
        }
        const tables = ['tickets', 'users', 'attachments', 'email_blacklist', 'logs'];
        for (const table of tables) {
          const rows = await this.db.query(`SELECT * FROM ${table}`);
          const json = JSON.stringify(rows.map(normalize), null, 2);
          archive.append(json, { name: `db_export/${table}.json` });
        }
      });

      const size = fs.statSync(fpath).size;
      await this.updateJob(jobId, 'SUCCESS', fpath, size);
      this.logger.log(`✅ Backup completo: ${fname} (${(size / 1024 / 1024).toFixed(2)} MB)`);
      await this.cleanOldBackups(7);
      return { jobId, file: fname };
    } catch (error) {
      await this.updateJob(jobId, 'FAILED', null, 0, error.message);
      this.logger.error(`❌ Backup falhou: ${error.message}`);
      throw error;
    }
  }

  async runFilesBackup(): Promise<{ jobId: number; file: string }> {
    const jobId = await this.createJob('files');
    await this.updateJob(jobId, 'RUNNING');

    try {
      const ts    = dayjs().format('YYYYMMDD_HHmmss');
      const fname = `backup_files_${ts}.zip`;
      const fpath = path.join(this.backupPath, fname);

      await this.createZip(fpath, (archive) => {
        if (fs.existsSync(this.storagePath)) {
          archive.directory(this.storagePath, 'storage');
        }
      });

      const size = fs.statSync(fpath).size;
      await this.updateJob(jobId, 'SUCCESS', fpath, size);
      return { jobId, file: fname };
    } catch (error) {
      await this.updateJob(jobId, 'FAILED', null, 0, error.message);
      throw error;
    }
  }

  async listJobs(limit = 20): Promise<any[]> {
    const rows = await this.db.query(
      `SELECT id, type, status, file_path, file_size, error_msg, started_at, finished_at, created_at
       FROM backup_jobs
       ORDER BY created_at DESC
       FETCH FIRST :limit ROWS ONLY`,
      [limit],
    );
    return rows.map(normalize);
  }

  async removeJob(id: number): Promise<{ message: string }> {
    const rows = await this.db.query(
      `SELECT id, file_path FROM backup_jobs WHERE id = :id`,
      { id },
    );
    if (!rows.length) throw new NotFoundException('Backup não encontrado');

    const job = normalize(rows[0]);

    // Remove o arquivo .zip do disco se existir
    if (job.file_path && fs.existsSync(job.file_path)) {
      fs.unlinkSync(job.file_path);
      this.logger.log(`🗑️  Arquivo de backup removido: ${job.file_path}`);
    }

    // Remove o registro do banco
    await this.db.execute(`DELETE FROM backup_jobs WHERE id = :id`, [id]);
    this.logger.log(`🗑️  Registro de backup #${id} excluído`);

    return { message: `Backup #${id} excluído com sucesso` };
  }

  private createZip(
    filePath: string,
    populate: (archive: archiver.Archiver) => void | Promise<void>,
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const output  = fs.createWriteStream(filePath);
      const archive = archiver('zip', { zlib: { level: 6 } });
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      await populate(archive);
      archive.finalize();
    });
  }

  private async createJob(type: string): Promise<number> {
    const id = await this.db.insertAndGetId(
      `INSERT INTO backup_jobs (type, status, started_at)
       VALUES (:type, 'PENDING', CURRENT_TIMESTAMP)
       RETURNING id INTO :id`,
      { type, id: null },
    );
    const realId = Array.isArray(id) ? id[0] : id;
    return realId;
  }

  private async updateJob(
    id: number, status: string,
    filePath?: string, fileSize?: number, errorMsg?: string,
  ): Promise<void> {
    const realId = Array.isArray(id) ? id[0] : Number(id);
    const isFinished = status === 'SUCCESS' || status === 'FAILED';
    if (isFinished) {
      await this.db.execute(
        `UPDATE backup_jobs
         SET status = :status,
             file_path = :file_path,
             file_size = :file_size,
             error_msg = :error_msg,
             finished_at = CURRENT_TIMESTAMP
         WHERE id = :id`,
        { id: realId, status, file_path: filePath || null, file_size: fileSize || 0, error_msg: errorMsg || null },
      );
    } else {
      await this.db.execute(
        `UPDATE backup_jobs SET status = :status WHERE id = :id`,
        { id: realId, status },
      );
    }
  }

  private async cleanOldBackups(keep: number): Promise<void> {
    const files = fs.readdirSync(this.backupPath)
      .filter((f) => f.endsWith('.zip'))
      .map((f) => ({ name: f, time: fs.statSync(path.join(this.backupPath, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);
    const toDelete = files.slice(keep);
    for (const f of toDelete) {
      fs.unlinkSync(path.join(this.backupPath, f.name));
      this.logger.log(`🗑️  Backup antigo removido: ${f.name}`);
    }
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}
