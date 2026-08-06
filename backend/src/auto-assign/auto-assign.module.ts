import { Module } from '@nestjs/common';
import { AutoAssignService } from './auto-assign.service';
import { AutoAssignController } from './auto-assign.controller';
import { DatabaseModule } from '../config/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AutoAssignController],
  providers: [AutoAssignService],
  exports: [AutoAssignService],
})
export class AutoAssignModule {}