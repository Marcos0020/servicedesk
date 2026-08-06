import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, ParseIntPipe, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketFilterDto } from './dto/ticket-filter.dto';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Chamados')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // ─── Dashboard ───────────────────────────────────────────────────────────────

  @Get('summary')
  @ApiOperation({ summary: 'Resumo de chamados para o dashboard' })
  getSummary(@Request() req) {
    // Técnico vê resumo apenas dos chamados atribuídos a ele
    const responsibleId = req.user?.role === 'technician' ? Number(req.user.id) : undefined;
    return this.ticketsService.getSummary(responsibleId);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Chamados recentes para o dashboard' })
  getRecent(@Query('limit') limit: number, @Request() req) {
    const responsibleId = req.user?.role === 'technician' ? Number(req.user.id) : undefined;
    return this.ticketsService.getRecent(limit, responsibleId);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Categorias e subcategorias distintas dos chamados' })
  getCategories() {
    return this.ticketsService.getCategories();
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar chamados — técnico vê apenas os dele no dashboard, lista completa aqui' })
  findAll(@Query() filter: TicketFilterDto) {
    // TODOS os papéis visualizam todos os chamados na listagem
    return this.ticketsService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de um chamado — visível para todos os papéis' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    // TODOS os papéis podem ver os detalhes completos de qualquer chamado
    return this.ticketsService.findOne(id);
  }

  @Post()
  @Roles('admin', 'supervisor', 'technician')
  @ApiOperation({ summary: 'Abrir novo chamado — todos os papéis' })
  create(@Body() dto: CreateTicketDto, @Request() req) {
    return this.ticketsService.create(dto, req.user?.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar chamado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketDto,
    @Request() req,
  ) {
    const user = req.user;

    // Técnico: pode editar tudo, MAS só pode atribuir para si mesmo
    if (user?.role === 'technician') {
      if (dto.responsible_id !== undefined) {
        // Força atribuição apenas para si mesmo
        dto.responsible_id = Number(user.id);
      }
    }

    return this.ticketsService.update(id, dto, user?.id);
  }

  @Delete(':id')
  @Roles('admin', 'supervisor')
  @ApiOperation({ summary: 'Excluir chamado — admin e supervisor' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.ticketsService.remove(id, req.user?.id);
  }
}
