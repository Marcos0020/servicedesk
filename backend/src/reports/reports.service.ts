import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { DatabaseService } from '../config/database.service';
import * as dayjs from 'dayjs';

function normalize(row: any): any {
  if (!row) return null;
  const result: any = {};
  for (const key of Object.keys(row)) {
    result[key.toLowerCase()] = row[key];
  }
  return result;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly db: DatabaseService) {}

  async getReportData(dateFrom: string, dateTo: string, status?: string): Promise<any[]> {
    const conditions: string[] = [
      `t.created_at >= :date_from`,
      `t.created_at <= :date_to`,
    ];
    const binds: Record<string, any> = {
      date_from: new Date(dateFrom),
      date_to: new Date(dateTo + 'T23:59:59'),
    };

    if (status) {
      conditions.push('t.status = :status');
      binds.status = status;
    }

    const rows = await this.db.query(
      `SELECT
         t.id, t.title, t.description, t.requester_name, t.requester_email,
         t.category, t.subcategory, t.status, t.source,
         u.name AS responsible_name,
         t.created_at, t.updated_at, t.finalized_at,
         (SELECT COUNT(*) FROM attachments a WHERE a.ticket_id = t.id) AS attachment_count
       FROM tickets t
       LEFT JOIN users u ON u.id = t.responsible_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.created_at DESC`,
      binds,
    );
    return rows.map(normalize);
  }

  async generateExcel(dateFrom: string, dateTo: string, status?: string): Promise<Buffer> {
    const rows = await this.getReportData(dateFrom, dateTo, status);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Service Desk Sistema';
    workbook.created = new Date();

    // ── Sheet 1: Chamados ──
    const sheet = workbook.addWorksheet('Chamados', {
      pageSetup: { fitToPage: true, orientation: 'landscape' },
    });

    const headerFill: ExcelJS.Fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' },
    };
    const headerFont: Partial<ExcelJS.Font> = {
      bold: true, color: { argb: 'FFFFFFFF' }, size: 11,
    };

    // Título principal
    sheet.mergeCells('A1:M1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `RELATÓRIO DE CHAMADOS — ${dayjs(dateFrom).format('DD/MM/YYYY')} a ${dayjs(dateTo).format('DD/MM/YYYY')}`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 35;

    // Subtítulo
    sheet.mergeCells('A2:M2');
    const subCell = sheet.getCell('A2');
    subCell.value = `Gerado em: ${dayjs().format('DD/MM/YYYY HH:mm')}   |   Total de chamados: ${rows.length}`;
    subCell.font = { italic: true, size: 10, color: { argb: 'FF555555' } };
    subCell.alignment = { horizontal: 'center' };
    sheet.getRow(2).height = 20;

    // Linha em branco
	// Definição das colunas SEM header (para não sobrescrever o título)
    sheet.columns = [
	  { key: 'id',               width: 8  },
      { key: 'title',            width: 40 },
      { key: 'description',      width: 40 },
      { key: 'requester_name',   width: 22 },
      { key: 'requester_email',  width: 28 },
      { key: 'category',         width: 18 },
      { key: 'subcategory',      width: 18 },
      { key: 'status',           width: 16 },
      { key: 'source',           width: 10 },
      { key: 'responsible_name', width: 22 },
      { key: 'created_at',       width: 18 },
      { key: 'updated_at',       width: 18 },
      { key: 'finalized_at',     width: 18 },
    ];

    // Linha em branco
    sheet.addRow([]);

    // Cabeçalho manual na linha 4
    sheet.getRow(4).values = [
      'ID', 'Título', 'Descrição', 'Solicitante', 'E-mail',
      'Categoria', 'Subcategoria',
      'Status', 'Origem', 'Responsável', 'Aberto em', 'Atualizado em', 'Finalizado em'
    ];

    // Estilo do cabeçalho (linha 4)
    const headerRow = sheet.getRow(4);
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FF1E3A5F' } },
        bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
        left:   { style: 'thin', color: { argb: 'FF1E3A5F' } },
        right:  { style: 'thin', color: { argb: 'FF1E3A5F' } },
      };
    });
    headerRow.height = 28;

    const statusColors: Record<string, string> = {
      ABERTO:       'FFFFC107',
      EM_ANDAMENTO: 'FF17A2B8',
      FINALIZADO:   'FF28A745',
    };

    // Linhas de dados
    rows.forEach((row, index) => {
      const dataRow = sheet.addRow({
        id:               row.id,
        title:            row.title,
		description:      row.description || '—',
        requester_name:   row.requester_name  || '—',
        requester_email:  row.requester_email || '—',
        category:         row.category    || '—',
        subcategory:      row.subcategory  || '—',
        status:           this.translateStatus(row.status),
        source:           row.source === 'EMAIL' ? 'E-mail' : 'Manual',
        responsible_name: row.responsible_name || 'Não atribuído',
        created_at:       row.created_at   ? dayjs(row.created_at).format('DD/MM/YYYY HH:mm')   : '',
        updated_at:       row.updated_at   ? dayjs(row.updated_at).format('DD/MM/YYYY HH:mm')   : '',
        finalized_at:     row.finalized_at ? dayjs(row.finalized_at).format('DD/MM/YYYY HH:mm') : '',
      });

      const bgColor = index % 2 === 0 ? 'FFF0F4FF' : 'FFFFFFFF';
      dataRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left:   { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right:  { style: 'thin', color: { argb: 'FFE0E0E0' } },
        };
      });

      // Colorir célula de status
      const statusCell = dataRow.getCell('status');
      if (statusColors[row.status]) {
        statusCell.fill = {
          type: 'pattern', pattern: 'solid',
          fgColor: { argb: statusColors[row.status] },
        };
        statusCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    // Congelar cabeçalho
    sheet.views = [{ state: 'frozen', ySplit: 4, activeCell: 'A5' }];

    // Filtro automático no cabeçalho
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 13 } };

    // ── Sheet 2: Resumo ──
    const summarySheet = workbook.addWorksheet('Resumo');
    summarySheet.columns = [
      { header: 'Métrica', key: 'metric', width: 30 },
      { header: 'Valor',   key: 'value',  width: 15 },
    ];

    const countByStatus   = this.countBy(rows, 'status');
    const countByCategory = this.countBy(rows, 'category');

    summarySheet.addRow({ metric: 'Total de Chamados',    value: rows.length });
    summarySheet.addRow({ metric: '— Abertos',            value: countByStatus['ABERTO']       || 0 });
    summarySheet.addRow({ metric: '— Em Andamento',       value: countByStatus['EM_ANDAMENTO'] || 0 });
    summarySheet.addRow({ metric: '— Finalizados',        value: countByStatus['FINALIZADO']   || 0 });
    // categorias dinâmicas
    Object.entries(countByCategory).forEach(([cat, count]) => {
      summarySheet.addRow({ metric: `— ${cat}`, value: count });
    });
    summarySheet.addRow({ metric: 'Período (início)',      value: dayjs(dateFrom).format('DD/MM/YYYY') });
    summarySheet.addRow({ metric: 'Período (fim)',         value: dayjs(dateTo).format('DD/MM/YYYY') });
    summarySheet.addRow({ metric: 'Gerado em',             value: dayjs().format('DD/MM/YYYY HH:mm') });

    const sumHeader = summarySheet.getRow(1);
    sumHeader.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
    });

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  private translateStatus(status: string): string {
    const map: Record<string, string> = {
      ABERTO: 'Aberto', EM_ANDAMENTO: 'Em Andamento', FINALIZADO: 'Finalizado',
    };
    return map[status] || status;
  }

  private countBy(rows: any[], key: string): Record<string, number> {
    return rows.reduce((acc, row) => {
      acc[row[key]] = (acc[row[key]] || 0) + 1;
      return acc;
    }, {});
  }
}
