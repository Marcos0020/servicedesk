import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { AutoAssignModule } from '../auto-assign/auto-assign.module';
import { DatabaseModule } from '../config/database.module';

@Module({
  imports: [DatabaseModule, AutoAssignModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}