import {
  IsArray, ArrayNotEmpty, IsInt, IsOptional, IsString, IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ---- Bulk Update Tickets ----
// Aplica os mesmos campos (categoria, subcategoria, status, responsável)
// a vários chamados de uma só vez. Cada campo é opcional: só os que
// vierem preenchidos são alterados; os demais permanecem como estão.
export class BulkUpdateTicketsDto {
  @ApiPropertyOptional({ example: [12, 13, 14], description: 'IDs dos chamados selecionados' })
  @IsArray()
  @ArrayNotEmpty({ message: 'Selecione ao menos um chamado.' })
  @IsInt({ each: true })
  @Type(() => Number)
  ids: number[];

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  subcategory?: string;

  @IsOptional() @IsIn(['ABERTO', 'EM_ANDAMENTO', 'FINALIZADO'])
  status?: string;

  @IsOptional() @IsInt() @Type(() => Number)
  responsible_id?: number;
}
