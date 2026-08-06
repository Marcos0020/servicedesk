import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../config/database.service';

function normalize(row: any): any {
  if (!row) return null;
  const result: any = {};
  for (const key of Object.keys(row)) {
    result[key.toLowerCase()] = row[key];
  }
  return result;
}

@Injectable()
export class TicketTypesService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(search?: string): Promise<any[]> {
    let where = '1=1';
    const binds: any = {};

    if (search) {
      where += ' AND UPPER(name) LIKE UPPER(:search)';
      binds.search = `%${search}%`;
    }

    const rows = await this.db.query(
      `SELECT id, name, description, is_active, created_at, updated_at
       FROM ticket_types
       WHERE ${where}
       ORDER BY name ASC`,
      Object.keys(binds).length ? binds : [],
    );
    return rows.map(normalize);
  }

  async findOne(id: number): Promise<any> {
    const rows = await this.db.query(
      `SELECT id, name, description, is_active, created_at, updated_at
       FROM ticket_types WHERE id = :id`,
      { id },
    );
    if (!rows.length) throw new NotFoundException('Tipo de chamado não encontrado');
    return normalize(rows[0]);
  }

  async create(name: string, description: string | null, userId: number): Promise<any> {
    // Check duplicate
    const existing = await this.db.query(
      `SELECT id FROM ticket_types WHERE UPPER(name) = UPPER(:name)`,
      { name },
    );
    if (existing.length) throw new ConflictException('Já existe um tipo com este nome');

    const id = await this.db.insertAndGetId(
      `INSERT INTO ticket_types (name, description, created_by)
       VALUES (:name, :description, :created_by)
       RETURNING id INTO :id`,
      { name: name.trim().toUpperCase(), description: description || null, created_by: userId || null, id: null },
    );
    const realId = Array.isArray(id) ? id[0] : Number(id);
    return this.findOne(realId);
  }

  async remove(id: number): Promise<{ message: string }> {
    await this.findOne(id); // throws 404 if not found
    await this.db.execute(`DELETE FROM ticket_types WHERE id = :id`, [id]);
    return { message: `Tipo #${id} excluído com sucesso` };
  }
}
