import { Controller, Get, Query, Res } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import * as dayjs from 'dayjs';

@ApiTags('Relatórios')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar dados do relatório (JSON)' })
  @ApiQuery({ name: 'date_from', required: true, example: '2024-01-01' })
  @ApiQuery({ name: 'date_to',   required: true, example: '2024-12-31' })
  @ApiQuery({ name: 'status',    required: false })
  getData(
    @Query('date_from') dateFrom: string,
    @Query('date_to')   dateTo: string,
    @Query('status')    status?: string,
  ) {
    return this.reportsService.getReportData(dateFrom, dateTo, status);
  }

  @Get('export/excel')
  @ApiOperation({ summary: 'Exportar relatório em Excel (.xlsx)' })
  async exportExcel(
    @Query('date_from') dateFrom: string,
    @Query('date_to')   dateTo: string,
    @Query('status')    status: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.generateExcel(dateFrom, dateTo, status);
    const filename = `relatorio_chamados_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
