import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TicketsModule } from './tickets/tickets.module';
import { TicketTypesModule } from './ticket-types/ticket-types.module';
import { EmailModule } from './email/email.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { ReportsModule } from './reports/reports.module';
import { BackupModule } from './backup/backup.module';
import { AutoAssignModule } from './auto-assign/auto-assign.module';
import { DatabaseModule } from './config/database.module';
import { appConfig } from './config/app.config';

@Module({
  imports: [
    // Configuration - loads .env file
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),

    // Cron job support
    ScheduleModule.forRoot(),

    // Rate limiting - prevents abuse (100 req/min per IP)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // Oracle DB connection pool
    DatabaseModule,

    // Feature modules
    AuthModule,
    UsersModule,
    TicketsModule,
    TicketTypesModule,
    EmailModule,
    AttachmentsModule,
    ReportsModule,
	BackupModule,
    AutoAssignModule,
  ],
})
export class AppModule {}
