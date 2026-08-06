import {
  Controller, Get, Post, Delete,
  Param, Body, Query, ParseIntPipe, Request, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { TicketTypesService } from './ticket-types.service';
import { Roles } from '../common/decorators/roles.decorator';

export class CreateTicketTypeDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

@ApiTags('Tipos de Chamado')
@ApiBearerAuth()
@Controller('ticket-types')
export class TicketTypesController {
  constructor(private readonly service: TicketTypesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar tipos de chamado — todos os perfis' })
  findAll(@Query('search') search?: string) {
    return this.service.findAll(search);
  }

  @Post()
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Criar tipo de chamado — admin e supervisor' })
  create(@Body() dto: CreateTicketTypeDto, @Request() req) {
    return this.service.create(dto.name, dto.description || null, req.user?.id);
  }

  @Delete(':id')
  @HttpCode(200)
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Excluir tipo de chamado — admin e supervisor' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
