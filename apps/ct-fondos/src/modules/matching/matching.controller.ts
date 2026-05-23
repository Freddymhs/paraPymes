import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MatchingService } from './matching.service.js';

@ApiTags('matching')
@Controller('matching')
export class MatchingController {
  constructor(private readonly service: MatchingService) {}

  @Get('fondos')
  @ApiOperation({ summary: 'Fondos compatibles con el perfil de la PYME' })
  @ApiQuery({ name: 'rut', required: true })
  @ApiQuery({ name: 'region', required: true })
  @ApiQuery({ name: 'rubroSii', required: true })
  @ApiQuery({ name: 'tamanoFiscal', required: true })
  findCompatibles(
    @Query('rut') rut: string,
    @Query('region') region: string,
    @Query('rubroSii') rubroSii: string,
    @Query('tamanoFiscal') tamanoFiscal: string,
  ) {
    return this.service.findFondosCompatibles({
      rut,
      region,
      rubroSii,
      tamanoFiscal,
    });
  }
}
