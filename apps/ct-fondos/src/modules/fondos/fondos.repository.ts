import { Injectable } from '@nestjs/common';
import type { Fondo } from '@prisma/client';
import { PrismaService } from '@database/prisma.service.js';
import type { FondoScraped } from '@modules/scraper/fondos-gob.scraper.js';
import { ESTADO_FONDO } from './fondo.constants.js';

@Injectable()
export class FondosRepository {
  constructor(private readonly prisma: PrismaService) {}

  // urlFuente es @unique en el schema — identificador natural del fondo scrapeado.
  // Opcionales ausentes se persisten como null: en update, undefined significaría
  // "no tocar" y dejaría montos/fechas stale cuando la fuente los quita.
  async upsertByUrlFuente(data: FondoScraped): Promise<Fondo> {
    const {
      urlFuente,
      descripcion,
      montoMax,
      fechaApertura,
      fechaCierre,
      ...resto
    } = data;
    const opcionales = {
      descripcion: descripcion ?? null,
      montoMax: montoMax ?? null,
      fechaApertura: fechaApertura ?? null,
      fechaCierre: fechaCierre ?? null,
    };

    return this.prisma.fondo.upsert({
      where: { urlFuente },
      create: { urlFuente, ...resto, ...opcionales },
      update: { ...resto, ...opcionales },
    });
  }

  async findActivos(): Promise<Fondo[]> {
    return this.prisma.fondo.findMany({
      where: { estado: ESTADO_FONDO.ABIERTO },
      orderBy: { fechaCierre: 'asc' },
    });
  }

  async findByRegionAndTipo(region: string, tipo: string): Promise<Fondo[]> {
    return this.prisma.fondo.findMany({
      where: {
        estado: ESTADO_FONDO.ABIERTO,
        OR: [{ regiones: { has: region } }, { regiones: { isEmpty: true } }],
        tiposBeneficiario: { has: tipo },
      },
      orderBy: { fechaCierre: 'asc' },
    });
  }
}
