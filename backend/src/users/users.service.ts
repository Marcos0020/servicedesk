import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../config/database.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  /** List all users (without password hash) */
  async findAll(): Promise<any[]> {
    return this.db.query(
      `SELECT id, name, email, role, is_active, created_at, updated_at
       FROM users
       ORDER BY name`,
    );
  }

  /** Find a single user by ID */
  async findOne(id: number): Promise<any> {
    const rows = await this.db.query(
      `SELECT id, name, email, role, is_active, created_at, updated_at
       FROM users WHERE id = :id`,
      [id],
    );
    if (!rows.length) throw new NotFoundException('Usuário não encontrado');
    return rows[0];
  }

  /** Find user by email (includes password_hash for auth) */
	async findByEmail(email: string): Promise<any> {
    const rows = await this.db.query(
      `SELECT id, name, email, password_hash, role, is_active
       FROM users WHERE LOWER(email) = LOWER(:email)`,
      [email],
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      id: row.ID ?? row.id,
      name: row.NAME ?? row.name,
      email: row.EMAIL ?? row.email,
      password_hash: row.PASSWORD_HASH ?? row.password_hash,
      role: row.ROLE ?? row.role,
      is_active: row.IS_ACTIVE ?? row.is_active,
    };
  }

  /** Create a new technician/admin user */
  async create(dto: CreateUserDto): Promise<any> {
    // Check for duplicate email
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('E-mail já cadastrado');

    const hash = await bcrypt.hash(dto.password, 12);

    const id = await this.db.insertAndGetId(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES (:name, :email, :hash, :role, 1)
       RETURNING id INTO :id`,
      { name: dto.name, email: dto.email, hash, role: dto.role || 'technician', id: null },
    );

    return this.findOne(id);
  }

  /** Update user fields */
  async update(id: number, dto: UpdateUserDto): Promise<any> {
    await this.findOne(id); // ensure exists

    if (dto.email) {
      const existing = await this.findByEmail(dto.email);
      if (existing && existing.id !== id) {
        throw new ConflictException('E-mail já em uso por outro usuário');
      }
    }

    const setClauses: string[] = [];
    const binds: Record<string, any> = { id };

    if (dto.name)     { setClauses.push('name = :name');     binds.name = dto.name; }
    if (dto.email)    { setClauses.push('email = :email');   binds.email = dto.email; }
    if (dto.role)     { setClauses.push('role = :role');     binds.role = dto.role; }
    if (dto.password) {
      binds.hash = await bcrypt.hash(dto.password, 12);
      setClauses.push('password_hash = :hash');
    }
    if (dto.is_active !== undefined) {
      setClauses.push('is_active = :is_active');
      binds.is_active = dto.is_active ? 1 : 0;
    }

    if (!setClauses.length) throw new BadRequestException('Nenhum campo para atualizar');

    await this.db.execute(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = :id`,
      binds,
    );

    return this.findOne(id);
  }

  /** Soft-delete: deactivate user */
  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.db.execute(
      `UPDATE users SET is_active = 0 WHERE id = :id`,
      [id],
    );
  }

  /** Return active technicians (and supervisors) for assignment dropdown */
  async findActiveTechnicians(): Promise<any[]> {
    return this.db.query(
      `SELECT id, name, email, role FROM users
       WHERE is_active = 1 AND role IN ('technician','supervisor','admin')
       ORDER BY role, name`,
    );
  }
}
