import { Module, Global, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';
import { DatabaseService } from './database.service';

/**
 * Global Oracle DB module - provides DatabaseService to all modules.
 * Uses connection pooling for performance.
 */
@Global()
@Module({
  providers: [
    {
      provide: 'ORACLE_POOL',
      useFactory: async (config: ConfigService): Promise<oracledb.Pool> => {
        const logger = new Logger('OracleDB');

        // Use THIN mode - no Oracle client libraries required
        oracledb.initOracleClient(); // optional: remove if using THIN mode only

        try {
          const pool = await oracledb.createPool({
            user: config.get('oracle.user'),
            password: config.get('oracle.password'),
            connectString: config.get('oracle.connectString'),
            poolMin: config.get<number>('oracle.poolMin', 2),
            poolMax: config.get<number>('oracle.poolMax', 10),
            poolIncrement: 1,
            poolTimeout: 60,
          });
          logger.log('Oracle DB connection pool created successfully');
          return pool;
        } catch (error) {
          logger.error('Failed to create Oracle DB pool', error.message);
          throw error;
        }
      },
      inject: [ConfigService],
    },
    DatabaseService,
  ],
  exports: ['ORACLE_POOL', DatabaseService],
})
export class DatabaseModule {}
