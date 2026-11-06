import {
  IsString, IsOptional, IsEmail, IsNumber, IsIn, MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// Validação de categoria/subcategoria:
// as categorias agora são gerenciadas pelo frontend (localStorage)
// e aceitam qualquer string respeitando o limite da coluna VARCHAR2(60).

// ---- Create Ticket ----
export class CreateTicketDto {
  @ApiProperty({ example: 'Sistema fora do ar' })
  @IsString()
  @MaxLength(500)
  title: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString() @MaxLength(200)
  requester_name?: string;

  @IsOptional() @IsEmail() @MaxLength(255)
  requester_email?: string;

  @IsOptional() @IsString() @MaxLength(60)
  category?: string;

  @IsOptional() @IsString() @MaxLength(60)
  subcategory?: string;

  @IsOptional() @IsNumber() @Type(() => Number)
  responsible_id?: number;
}

// ---- Update Ticket ----
export class UpdateTicketDto {
  @IsOptional() @IsString() @MaxLength(500) title?: string;
  @IsOptional() @IsString()                 description?: string;
  @IsOptional() @IsString() @MaxLength(200) requester_name?: string;
  @IsOptional() @IsEmail()  @MaxLength(255) requester_email?: string;
  @IsOptional() @IsString() @MaxLength(60)  category?: string;
  @IsOptional() @IsString() @MaxLength(60)  subcategory?: string;
  @IsOptional() @IsIn(['ABERTO', 'EM_ANDAMENTO', 'FINALIZADO']) status?: string;
  @IsOptional() @IsNumber() @Type(() => Number) responsible_id?: number;
}

// ---- Ticket Filter (query params) ----
export class TicketFilterDto {
  @IsOptional() @IsIn(['ABERTO', 'EM_ANDAMENTO', 'FINALIZADO']) status?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsString() @MaxLength(60) subcategory?: string;
  @IsOptional() @Type(() => Number) @IsNumber() responsible_id?: number;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsString() @MaxLength(30)  date_from?: string;
  @IsOptional() @IsString() @MaxLength(30)  date_to?: string;
  @IsOptional() @Type(() => Number) @IsNumber() page?: number;
  @IsOptional() @Type(() => Number) @IsNumber() limit?: number;
}
