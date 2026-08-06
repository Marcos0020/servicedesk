import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../config/database.service';

@Injectable()
export class AutoAssignService {
  private readonly logger = new Logger(AutoAssignService.name);
  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<any[]> {
    const rows = await this.db.query(
      `SELECT r.id, r.responsible_id, r.date_from, r.date_to, r.is_active, r.created_at,
              u.name AS responsible_name, c.name AS created_by_name
       FROM auto_assign_rules r
       LEFT JOIN users u ON u.id = r.responsible_id
       LEFT JOIN users c ON c.id = r.created_by
       ORDER BY r.date_from DESC`,
      [],
    );
    return rows.map((r: any) => {
      const out: any = {};
      for (const k of Object.keys(r)) out[k.toLowerCase()] = r[k];
      return out;
    });
  }

  async create(responsible_id: number, date_from: string, date_to: string, userId: number): Promise<any> {
    await this.db.execute(
      `INSERT INTO auto_assign_rules (responsible_id, date_from, date_to, is_active, created_by)
       VALUES (:responsible_id,
               TO_TIMESTAMP(:date_from, 'YYYY-MM-DD"T"HH24:MI:SS'),
               TO_TIMESTAMP(:date_to,   'YYYY-MM-DD"T"HH24:MI:SS'),
               1, :created_by)`,
      { responsible_id, date_from, date_to, created_by: userId },
    );
    return { message: 'Regra criada com sucesso' };
  }

  async remove(id: number): Promise<void> {
    await this.db.execute(
      `DELETE FROM auto_assign_rules WHERE id = :id`, { id },
    );
  }

  async getActiveRule(): Promise<{ responsible_id: number; responsible_name: string } | null> {
    const rows = await this.db.query(
      `SELECT r.responsible_id, u.name AS responsible_name
       FROM auto_assign_rules r
       LEFT JOIN users u ON u.id = r.responsible_id
       WHERE r.is_active = 1
         AND CURRENT_TIMESTAMP BETWEEN r.date_from AND r.date_to
       FETCH FIRST 1 ROWS ONLY`,
      [],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      responsible_id: r.RESPONSIBLE_ID ?? r.responsible_id,
      responsible_name: r.RESPONSIBLE_NAME ?? r.responsible_name,
    };
  }
}