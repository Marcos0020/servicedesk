import { Controller, Get, Post, Delete, Param, ParseIntPipe, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BackupService } from './backup.service';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Backup')
@ApiBearerAuth()
@Roles('admin')
@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get()
  @ApiOperation({ summary: 'Listar histórico de backups' })
  listJobs() { return this.backupService.listJobs(); }

  @Post('run')
  @HttpCode(200)
  @ApiOperation({ summary: 'Executar backup completo manualmente' })
  runFull() { return this.backupService.runFullBackup(); }

  @Post('run/files')
  @HttpCode(200)
  @ApiOperation({ summary: 'Executar backup de arquivos manualmente' })
  runFiles() { return this.backupService.runFilesBackup(); }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Excluir registro de backup (admin)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.backupService.removeJob(id);
  }
}
