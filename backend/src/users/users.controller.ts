import {
  Controller, Get, Post, Put, Delete,
  Param, Body, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Usuários')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos os usuários' })
  @Roles('admin', 'supervisor', 'technician')
  findAll() { return this.usersService.findAll(); }

  @Get('technicians')
  @ApiOperation({ summary: 'Listar técnicos ativos (para atribuição)' })
  findTechnicians() { return this.usersService.findActiveTechnicians(); }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar usuário por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) { return this.usersService.findOne(id); }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Criar usuário (admin only)' })
  create(@Body() dto: CreateUserDto) { return this.usersService.create(dto); }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Atualizar usuário (admin only)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Desativar usuário (admin only)' })
  remove(@Param('id', ParseIntPipe) id: number) { return this.usersService.remove(id); }
}
