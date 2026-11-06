import {
  Controller, Get, Post, Delete, Param, ParseIntPipe,
  UploadedFile, UseInterceptors, Request, Res, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { AttachmentsService } from './attachments.service';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Anexos')
@ApiBearerAuth()
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('ticket/:ticketId')
  @ApiOperation({ summary: 'Upload de anexo para um chamado' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: undefined /* memory */ }))
  uploadFile(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    return this.attachmentsService.saveFile(ticketId, file, req.user.id);
  }

  @Get('ticket/:ticketId')
  @ApiOperation({ summary: 'Listar anexos de um chamado' })
  findByTicket(@Param('ticketId', ParseIntPipe) ticketId: number) {
    return this.attachmentsService.findByTicket(ticketId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Baixar anexo' })
  async download(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const att = await this.attachmentsService.findOne(id);
      const fullPath = this.attachmentsService.getFullPath(att.file_path);

      if (!fs.existsSync(fullPath)) {
        res.status(HttpStatus.NOT_FOUND).json({ message: 'Arquivo físico não encontrado no servidor.' });
        return;
      }

      const stat = fs.statSync(fullPath);
      const fileSize = stat.size;
      const mimeType = att.mime_type || 'application/octet-stream';

      // Encode filename corretamente para RFC 5987 (suporta acentos)
      const safeName = att.original_name
        .replace(/[^\w\s.\-]/g, '')   // fallback ASCII simples
        .trim() || 'download';
      const encodedName = encodeURIComponent(att.original_name);

      res.writeHead(HttpStatus.OK, {
        'Content-Type':        mimeType,
        'Content-Length':      fileSize,
        'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
        'Cache-Control':       'no-cache, no-store, must-revalidate',
        'Pragma':              'no-cache',
        'Expires':             '0',
        'X-Content-Type-Options': 'nosniff',
      });

      // Pipe stream direto — mais eficiente para arquivos grandes
      const readStream = fs.createReadStream(fullPath);
      readStream.on('error', () => {
        if (!res.headersSent) {
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Erro ao ler arquivo.' });
        }
      });
      readStream.pipe(res);

    } catch (err: any) {
      if (!res.headersSent) {
        const status = err?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({ message: err?.message ?? 'Erro ao baixar anexo.' });
      }
    }
  }

  @Delete(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Excluir anexo (admin e supervisor)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.attachmentsService.remove(id);
  }
}
