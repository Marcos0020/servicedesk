import {
  Injectable, Logger, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../config/database.service';

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// Helper: normaliza colunas do Oracle (maiúsculas → minúsculas)
function normalize(row: any): any {
  if (!row) return null;
  const result: any = {};
  for (const key of Object.keys(row)) {
    result[key.toLowerCase()] = row[key];
  }
  return result;
}

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly storagePath: string;

  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
  ) {
    this.storagePath = config.get<string>('STORAGE_PATH', './storage');
    this.ensureDir(this.storagePath);
  }

  async saveFile(
    ticketId: number,
    file: Express.Multer.File,
    userId: number,
  ): Promise<any> {
    this.validateFile(file.mimetype, file.size, file.originalname);
    const { stored_name, file_path, full_path } = this.buildFilePath(ticketId, file.originalname);
    this.ensureDir(path.dirname(full_path));
    fs.writeFileSync(full_path, file.buffer);
    return this.saveRecord(ticketId, file.originalname, stored_name, file_path, file.mimetype, file.size, userId);
  }

  async saveBuffer(
    ticketId: number,
    originalName: string,
    mimeType: string,
    buffer: Buffer,
    userId: number | null,
  ): Promise<any> {
    this.validateFile(mimeType, buffer.length, originalName);
    const { stored_name, file_path, full_path } = this.buildFilePath(ticketId, originalName);
    this.ensureDir(path.dirname(full_path));
    fs.writeFileSync(full_path, buffer);
    return this.saveRecord(ticketId, originalName, stored_name, file_path, mimeType, buffer.length, userId);
  }

  async findOne(id: number): Promise<any> {
    const rows = await this.db.query(
      `SELECT * FROM attachments WHERE id = :id`, { id },
    );
    if (!rows.length) throw new NotFoundException('Arquivo não encontrado');
    return normalize(rows[0]);
  }

  async findByTicket(ticketId: number): Promise<any[]> {
    const rows = await this.db.query(
      `SELECT id, original_name, file_path, mime_type, file_size, created_at
       FROM attachments WHERE ticket_id = :ticket_id ORDER BY created_at`,
      { ticket_id: ticketId },
    );
    return rows.map(normalize);
  }

  async remove(id: number): Promise<void> {
    const att = await this.findOne(id);
    const full_path = path.join(this.storagePath, att.file_path);
    if (fs.existsSync(full_path)) fs.unlinkSync(full_path);
    await this.db.execute(`DELETE FROM attachments WHERE id = :id`, [id]);
  }

  getFullPath(filePath: string): string {
    return path.join(this.storagePath, filePath);
  }

  private validateFile(mimeType: string, size: number, name: string): void {
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido: ${mimeType}. Permitidos: imagens, PDF, Excel, Word.`,
      );
    }
    if (size > MAX_FILE_SIZE) {
      throw new BadRequestException(`Arquivo muito grande. Máximo: 20MB`);
    }
  }

  private buildFilePath(ticketId: number, originalName: string) {
    const ext = path.extname(originalName) || `.${mime.extension(originalName) || 'bin'}`;
    const stored_name = `${uuidv4()}${ext}`;
    const subDir = `tickets/${ticketId}`;
    const file_path = `${subDir}/${stored_name}`;
    const full_path = path.join(this.storagePath, file_path);
    return { stored_name, file_path, full_path };
  }

  private async saveRecord(
    ticketId: number,
    originalName: string,
    storedName: string,
    filePath: string,
    mimeType: string,
    fileSize: number,
    userId: number | null,
  ): Promise<any> {
    const id = await this.db.insertAndGetId(
      `INSERT INTO attachments (ticket_id, original_name, stored_name, file_path, mime_type, file_size, uploaded_by)
       VALUES (:ticket_id, :original_name, :stored_name, :file_path, :mime_type, :file_size, :uploaded_by)
       RETURNING id INTO :id`,
      {
        ticket_id: ticketId,
        original_name: originalName,
        stored_name: storedName,
        file_path: filePath,
        mime_type: mimeType,
        file_size: fileSize,
        uploaded_by: userId,
        id: null,
      },
    );
    const realId = Array.isArray(id) ? id[0] : id;
    return this.findOne(realId);
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}
