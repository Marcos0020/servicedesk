import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { EmailScheduler } from './email.scheduler';
import { TicketsModule } from '../tickets/tickets.module';
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [TicketsModule, AttachmentsModule],
  controllers: [EmailController],
  providers: [EmailService, EmailScheduler],
  exports: [EmailService],
})
export class EmailModule {}
