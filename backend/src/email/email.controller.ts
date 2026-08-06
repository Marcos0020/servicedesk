import {
  Controller, Get, Post, Delete, Body, Param,
  ParseIntPipe, Request, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { EmailService } from './email.service';
import { Roles } from '../common/decorators/roles.decorator';

class AddBlacklistDto {
  @IsEmail() email: string;
  @IsOptional() @IsString() reason?: string;
}

@ApiTags('E-mail / Blacklist')
@ApiBearerAuth()
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('fetch')
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Disparar busca manual de e-mails' })
  async triggerFetch() {
    return this.emailService.fetchAndProcessEmails();
  }

  @Get('blacklist')
  @ApiOperation({ summary: 'Listar e-mails bloqueados' })
  getBlacklist() { return this.emailService.getBlacklist(); }

  @Post('blacklist')
  @Roles('admin')
  @ApiOperation({ summary: 'Adicionar e-mail à blacklist' })
  addToBlacklist(@Body() dto: AddBlacklistDto, @Request() req) {
    return this.emailService.addToBlacklist(dto.email, dto.reason || '', req.user.id);
  }

  @Delete('blacklist/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Remover e-mail da blacklist' })
  removeFromBlacklist(@Param('id', ParseIntPipe) id: number) {
    return this.emailService.removeFromBlacklist(id);
  }
}
