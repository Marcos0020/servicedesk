import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../config/database.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketFilterDto } from './dto/ticket-filter.dto';
import { AutoAssignService } from '../auto-assign/auto-assign.service';

@Injectable()
export class TicketsService {
	private readonly logger = new Logger(TicketsService.name);
	constructor(
     private readonly db: DatabaseService,
     private readonly autoAssignService: AutoAssignService,
  ) {}

  async findAll(filter: TicketFilterDto): Promise<{ data: any[]; total: number }> {
    const conditions: string[] = ['1=1'];
    const binds: Record<string, any> = {};

    if (filter.status) {
      conditions.push('t.status = :status');
      binds.status = filter.status;
    }
    if (filter.category) {
      conditions.push('t.category = :category');
      binds.category = filter.category;
    }
    if (filter.subcategory) {
      conditions.push('t.subcategory = :subcategory');
      binds.subcategory = filter.subcategory;
    }
    if (filter.responsible_id) {
      conditions.push('t.responsible_id = :responsible_id');
      binds.responsible_id = Number(filter.responsible_id);
    }
    if (filter.search) {
      conditions.push('(UPPER(t.title) LIKE UPPER(:search) OR UPPER(t.requester_email) LIKE UPPER(:search) OR UPPER(t.requester_name) LIKE UPPER(:search))');
      binds.search = `%${filter.search}%`;
    }
	if (filter.date_from) {
      conditions.push('NVL(t.email_sent_at, t.created_at) >= TO_TIMESTAMP(:date_from, \'YYYY-MM-DD"T"HH24:MI:SS\')');
      binds.date_from = filter.date_from.length === 10
        ? `${filter.date_from}T00:00:00`
        : filter.date_from;
    }
    if (filter.date_to) {
      conditions.push('NVL(t.email_sent_at, t.created_at) <= TO_TIMESTAMP(:date_to, \'YYYY-MM-DD"T"HH24:MI:SS\')');
      binds.date_to = filter.date_to.length === 10
        ? `${filter.date_to}T23:59:59`
        : filter.date_to;
    }

    const where  = conditions.join(' AND ');
    const page   = filter.page  || 1;
    const limit  = filter.limit || 20;
    const offset = (page - 1) * limit;

    const countRows = await this.db.query(
      `SELECT COUNT(*) AS total FROM tickets t WHERE ${where}`, binds,
    );
    const total = Number(countRows[0]?.TOTAL || 0);

    const data = await this.db.query(
	  `SELECT t.id, t.title, t.requester_name, t.requester_email,
              t.category, t.subcategory, t.status, t.source,
              t.created_at, t.updated_at, t.finalized_at, t.email_sent_at,
              u.id AS responsible_id, u.name AS responsible_name
       FROM tickets t
       LEFT JOIN users u ON u.id = t.responsible_id
       WHERE ${where}
       ORDER BY NVL(t.email_sent_at, t.created_at) DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...binds, offset, limit },
    );

    return { data, total };
  }

  async findOne(id: number): Promise<any> {
    const rows = await this.db.query(
	   `SELECT t.id, t.title, t.description, t.requester_name, t.requester_email,
              t.category, t.subcategory, t.status, t.source,
              t.created_at, t.updated_at, t.finalized_at, t.email_sent_at,
              u.id AS responsible_id, u.name AS responsible_name, u.email AS responsible_email
       FROM tickets t
       LEFT JOIN users u ON u.id = t.responsible_id
       WHERE t.id = :id`,
      { id: Number(id) },
    );
    if (!rows.length) throw new NotFoundException('Chamado não encontrado');
    const ticket = rows[0];

    ticket.attachments = await this.db.query(
      `SELECT id, original_name, file_path, mime_type, file_size, created_at
       FROM attachments WHERE ticket_id = :id ORDER BY created_at`,
      { id: Number(id) },
    );

    ticket.logs = await this.db.query(
      `SELECT l.action, l.old_value, l.new_value, l.created_at, u.name AS performed_by
       FROM logs l
       LEFT JOIN users u ON u.id = l.performed_by
       WHERE l.entity = 'ticket' AND l.entity_id = :id
       ORDER BY l.created_at DESC`,
      { id: Number(id) },
    );

    return ticket;
  }

  async create(dto: CreateTicketDto, userId?: number): Promise<any> {
    const id = await this.db.insertAndGetId(
      `INSERT INTO tickets (title, description, requester_name, requester_email,
                            category, subcategory, status, responsible_id, source)
       VALUES (:title, :description, :requester_name, :requester_email,
               :category, :subcategory, 'ABERTO', :responsible_id, 'MANUAL')
       RETURNING id INTO :id`,
      {
        title:           dto.title,
        description:     dto.description     || null,
        requester_name:  dto.requester_name  || null,
        requester_email: dto.requester_email || null,
        category:        dto.category        || 'SUPORTE',
        subcategory:     dto.subcategory     || 'OUTRO',
        responsible_id:  dto.responsible_id  || (await this.autoAssignService.getActiveRule())?.responsible_id || null,
        id: null,
      },
    );
    const realId = Array.isArray(id) ? id[0] : Number(id);
    await this.addLog(realId, 'created', null, 'ABERTO', userId);
    return this.findOne(realId);
  }

  async createFromEmail(data: {
    title: string; description: string;
    requester_name: string; requester_email: string; email_message_id: string;
    email_sent_at?: string | null;
  }): Promise<any> {
    const existing = await this.db.query(
      `SELECT id FROM tickets WHERE email_message_id = :mid`, { mid: data.email_message_id },
    );
    if (existing.length) return null;

	const activeRule = await this.autoAssignService.getActiveRule();
    const id = await this.db.insertAndGetId(
	  `INSERT INTO tickets (title, description, requester_name, requester_email,
                            category, subcategory, status, source, email_message_id, responsible_id, email_sent_at)
       VALUES (:title, :description, :requester_name, :requester_email,
               'SUPORTE', 'OUTRO', 'ABERTO', 'EMAIL', :email_message_id, :responsible_id,
               CASE WHEN :email_sent_at IS NULL THEN NULL ELSE TO_TIMESTAMP(:email_sent_at, 'YYYY-MM-DD"T"HH24:MI:SS') END)
       RETURNING id INTO :id`,
      { ...data, responsible_id: activeRule?.responsible_id || null, email_sent_at: data.email_sent_at || null, id: null },
    );
    const realId = Array.isArray(id) ? id[0] : Number(id);
    await this.addLog(realId, 'created_from_email', null, 'ABERTO', null);
    return this.findOne(realId);
  }

  async update(id: number, dto: UpdateTicketDto, userId?: number): Promise<any> {
    const current = await this.findOne(id);
    const setClauses: string[] = [];
    const binds: Record<string, any> = { id };

    if (dto.title !== undefined && dto.title !== (current.TITLE ?? current.title)) {
      setClauses.push('title = :title'); binds.title = dto.title;
      await this.addLog(id, 'title_changed', current.TITLE ?? current.title, dto.title, userId);
    }
    if (dto.description !== undefined) {
      setClauses.push('description = :description'); binds.description = dto.description;
      const old = current.DESCRIPTION ?? current.description;
      if (old !== dto.description)
        await this.addLog(id, 'description_changed', old || '(vazio)', dto.description || '(vazio)', userId);
    }
    if (dto.category !== undefined && dto.category !== (current.CATEGORY ?? current.category)) {
      setClauses.push('category = :category'); binds.category = dto.category;
      await this.addLog(id, 'category_changed', current.CATEGORY ?? current.category, dto.category, userId);
    }
    if (dto.subcategory !== undefined && dto.subcategory !== (current.SUBCATEGORY ?? current.subcategory)) {
      setClauses.push('subcategory = :subcategory'); binds.subcategory = dto.subcategory;
      await this.addLog(id, 'subcategory_changed', current.SUBCATEGORY ?? current.subcategory, dto.subcategory, userId);
    }
    if (dto.status !== undefined && dto.status !== (current.STATUS ?? current.status)) {
      setClauses.push('status = :status'); binds.status = dto.status;
      await this.addLog(id, 'status_changed', current.STATUS ?? current.status, dto.status, userId);
    }
	if (dto.responsible_id !== undefined) {
	  const currentResponsibleId = current.RESPONSIBLE_ID ?? current.responsible_id ?? null;
	  const newResponsibleId =
		dto.responsible_id == null
		  ? null
		  : Number(dto.responsible_id);

	  if (currentResponsibleId !== newResponsibleId) {
		setClauses.push('responsible_id = :responsible_id');
		binds.responsible_id = newResponsibleId;
		const oldName = current.RESPONSIBLE_NAME ?? current.responsible_name ?? 'Não atribuído';
		let newName = 'Não atribuído';
		if (newResponsibleId) {
		  try {
			const rows = await this.db.query(`SELECT name FROM users WHERE id = :id`, { id: newResponsibleId });
			newName = rows[0]?.NAME ?? rows[0]?.name ?? rows[0]?.['NAME'] ?? String(newResponsibleId);
		  } catch (e) { 
		  this.logger.warn(`Erro ao buscar nome do responsável: ${e.message}`);
		  newName = String(newResponsibleId); 
		}
		}
		await this.addLog(id, 'assigned', oldName, newName, userId);
	  }
	}
    if (dto.requester_name !== undefined && dto.requester_name !== (current.REQUESTER_NAME ?? current.requester_name)) {
      setClauses.push('requester_name = :requester_name'); binds.requester_name = dto.requester_name;
      await this.addLog(id, 'requester_name_changed', current.REQUESTER_NAME ?? current.requester_name, dto.requester_name, userId);
    }
    if (dto.requester_email !== undefined && dto.requester_email !== (current.REQUESTER_EMAIL ?? current.requester_email)) {
      setClauses.push('requester_email = :requester_email'); binds.requester_email = dto.requester_email;
      await this.addLog(id, 'requester_email_changed', current.REQUESTER_EMAIL ?? current.requester_email, dto.requester_email, userId);
    }

    if (setClauses.length) {
      await this.db.execute(
        `UPDATE tickets SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = :id`, binds,
      );
    }
    return this.findOne(id);
  }

  async remove(id: number, userId?: number): Promise<void> {
    const ticket = await this.findOne(id);
    await this.addLog(id, 'deleted', ticket.TITLE ?? ticket.title, null, userId);
    await this.db.execute(`DELETE FROM attachments WHERE ticket_id = :id`, { id: Number(id) });
    await this.db.execute(`DELETE FROM tickets WHERE id = :id`, { id: Number(id) });
  }

  async getSummary(responsibleId?: number): Promise<any> {
    const where = responsibleId ? `WHERE responsible_id = :rid` : '';
    const binds = responsibleId ? { rid: responsibleId } : {};
    const rows = await this.db.query(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'ABERTO'       THEN 1 ELSE 0 END) AS abertos,
        SUM(CASE WHEN status = 'EM_ANDAMENTO' THEN 1 ELSE 0 END) AS em_andamento,
        SUM(CASE WHEN status = 'FINALIZADO'   THEN 1 ELSE 0 END) AS finalizados
       FROM tickets ${where}`, binds,
    );
    return rows[0];
  }

  async getRecent(limit = 10, responsibleId?: number): Promise<any[]> {
    const where = responsibleId ? `WHERE t.responsible_id = :rid` : '';
    const binds: any = { limit: Number(limit) };
    if (responsibleId) binds.rid = responsibleId;
    return this.db.query(
      `SELECT t.id, t.title, t.status, t.category, t.subcategory, t.created_at, u.name AS responsible_name
       FROM tickets t LEFT JOIN users u ON u.id = t.responsible_id
       ${where} ORDER BY t.created_at DESC FETCH FIRST :limit ROWS ONLY`, binds,
    );
  }

  async getCategories(): Promise<{ category: string; subcategories: string[] }[]> {
    const rows = await this.db.query(
      `SELECT DISTINCT category, subcategory FROM tickets WHERE category IS NOT NULL ORDER BY category, subcategory`,
      [],
    );
    const map: Record<string, string[]> = {};
    for (const row of rows) {
      const cat = row.CATEGORY ?? row.category;
      const sub = row.SUBCATEGORY ?? row.subcategory;
      if (!map[cat]) map[cat] = [];
      if (sub && !map[cat].includes(sub)) map[cat].push(sub);
    }
    return Object.entries(map).map(([category, subcategories]) => ({ category, subcategories }));
  }

  private async addLog(
    ticketId: number, action: string,
    oldValue: string | null, newValue: string | null, performedBy?: number,
  ): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO logs (entity, entity_id, action, old_value, new_value, performed_by)
         VALUES ('ticket', :ticket_id, :action, :old_value, :new_value, :performed_by)`,
        { ticket_id: ticketId, action, old_value: oldValue || null, new_value: newValue || null,
          performed_by: performedBy ? Number(performedBy) : null },
      );
    } catch (e) { this.logger.warn(`Log não registrado: ${e.message}`); }
  }
}
