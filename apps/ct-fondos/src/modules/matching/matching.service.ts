import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service.js';

export interface PymeFilters {
  rut: string;
  region: string;
  rubroSii: string;
  tamanoFiscal: string;
  antiguedadAnios?: number;
}

@Injectable()
export class MatchingService {
  constructor(private readonly prisma: PrismaService) {}

  // Matching paramétrico determinista: no usa ML, solo reglas de elegibilidad.
  // Motor ML viene en ct-analytics cuando haya suficientes datos históricos.
  async findFondosCompatibles(filters: PymeFilters) {
    const fondos = await this.prisma.fondo.findMany({
      where: {
        estado: 'abierto',
        OR: [
          { regiones: { has: filters.region } },
          { regiones: { isEmpty: true } },
        ],
      },
      orderBy: { fechaCierre: 'asc' },
    });

    // TODO: filtrar por tiposBeneficiario, tamanoFiscal, rubroSii
    // cuando tengamos los datos estructurados del scraper
    return fondos;
  }
}
