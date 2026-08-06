import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AutoAssignService } from './auto-assign.service';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Atribuição Automática')
@ApiBearerAuth()
@Controller('auto-assign')
export class AutoAssignController {
  constructor(private readonly service: AutoAssignService) {}

  @Get()
  @ApiOperation({ summary: 'Listar regras de atribuição automática' })
  @Roles('admin', 'supervisor')
  findAll() { return this.service.findAll(); }

  @Post()
  @ApiOperation({ summary: 'Criar regra de atribuição automática' })
  @Roles('admin', 'supervisor')
  create(@Body() body: { responsible_id: number; date_from: string; date_to: string }, @Request() req) {
    return this.service.create(body.responsible_id, body.date_from, body.date_to, req.user?.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover regra' })
  @Roles('admin', 'supervisor')
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}