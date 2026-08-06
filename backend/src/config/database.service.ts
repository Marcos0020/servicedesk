import { Injectable, Inject, Logger } from '@nestjs/common';
import * as oracledb from 'oracledb';

/**
 * DatabaseService wraps Oracle connection pool operations.
 * All modules inject this service to run parameterized queries.
 */
@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @Inject('ORACLE_POOL') private readonly pool: oracledb.Pool,
  ) {
    // Return plain JS objects instead of oracledb.Lob etc.
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    oracledb.fetchAsString = [oracledb.CLOB]; // CLOBs as strings
  }

  /**
   * Execute a SELECT query. Returns an array of row objects.
   */
  async query<T = any>(
    sql: string,
    binds: any[] | Record<string, any> = [],
  ): Promise<T[]> {
    let connection: oracledb.Connection;
    try {
      connection = await this.pool.getConnection();
      const result = await connection.execute<T>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      return (result.rows as T[]) || [];
    } catch (error) {
      this.logger.error(`DB query error: ${error.message}`, sql);
      throw error;
    } finally {
      if (connection) await connection.close();
    }
  }

  /**
   * Execute an INSERT/UPDATE/DELETE. Returns rowsAffected and lastRowid.
   */
  async execute(
    sql: string,
    binds: any[] | Record<string, any> = [],
  ): Promise<{ rowsAffected: number; lastRowid?: string }> {
    let connection: oracledb.Connection;
    try {
      connection = await this.pool.getConnection();
      const result = await connection.execute(sql, binds, {
        autoCommit: true,
      });
      return {
        rowsAffected: result.rowsAffected || 0,
        lastRowid: (result as any).lastRowid,
      };
    } catch (error) {
      this.logger.error(`DB execute error: ${error.message}`, sql);
      throw error;
    } finally {
      if (connection) await connection.close();
    }
  }

  /**
   * Execute multiple statements in a single transaction.
   */
  async executeTransaction(
    operations: Array<{ sql: string; binds?: any[] | Record<string, any> }>,
  ): Promise<void> {
    let connection: oracledb.Connection;
    try {
      connection = await this.pool.getConnection();
      for (const op of operations) {
        await connection.execute(op.sql, op.binds || [], { autoCommit: false });
      }
      await connection.commit();
    } catch (error) {
      if (connection) await connection.rollback();
      this.logger.error(`DB transaction error: ${error.message}`);
      throw error;
    } finally {
      if (connection) await connection.close();
    }
  }

  /**
   * Execute INSERT and return the generated ID.
   */
  async insertAndGetId(
    sql: string,
    binds: any[] | Record<string, any> = [],
  ): Promise<number> {
    let connection: oracledb.Connection;
    try {
      connection = await this.pool.getConnection();
      const idBind = { id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } };
      const allBinds = Array.isArray(binds)
        ? [...binds, idBind.id]
        : { ...binds, ...idBind };
	  const result = await connection.execute(sql, allBinds, { autoCommit: true });
	  const raw = (result.outBinds as any).id ?? (result.outBinds as any[])?.[0];
	  return Array.isArray(raw) ? raw[0] : raw;
    } catch (error) {
      this.logger.error(`DB insertAndGetId error: ${error.message}`, sql);
      throw error;
    } finally {
      if (connection) await connection.close();
    }
  }
}
