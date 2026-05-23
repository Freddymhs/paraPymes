import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LicitacionesService } from './licitaciones.service.js';

@ApiTags('licitaciones')
@Controller('licitaciones')
export class LicitacionesController {
  constructor(private readonly service: LicitacionesService) {}

  @Get()
  @ApiOperation({ summary: 'Licitaciones publicadas activas' })
  findPublicadas() {
    return this.service.findPublicadas();
  }

  @Get(':codigo')
  @ApiOperation({ summary: 'Detalle de una licitación por código externo' })
  findOne(@Param('codigo') codigo: string) {
    return this.service.findOne(codigo);
  }

  @Get('stats/count')
  @ApiOperation({ summary: 'Total de licitaciones en la base de datos' })
  count() {
    return this.service.count();
  }
}
