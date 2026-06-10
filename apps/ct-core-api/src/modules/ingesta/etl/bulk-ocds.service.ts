import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { unpack } from '7zip-min';
import { LicitacionesRepository } from '@modules/licitaciones/licitaciones.repository';
import { extraerReleases, normalizarReleaseOcds } from './ocds.mapper';

const PREFIJO_TMP = 'bulk-ocds-';
const EXTENSION_JSON = '.json';

export interface ResumenEtl {
  readonly leidos: number;
  readonly upsertados: number;
  readonly descartados: number;
}

/**
 * ETL histórico/mensual desde los dumps .7z OCDS de
 * datos-abiertos.chilecompra.cl. NO es el cron diario: se ejecuta manualmente
 * en off-hours (MongoDB M0 tolera ~100 ops/s) con el archivo ya descargado.
 */
@Injectable()
export class BulkOcdsService {
  private readonly logger = new Logger(BulkOcdsService.name);

  constructor(private readonly repository: LicitacionesRepository) {}

  /** Descomprime el .7z a disco temporal, procesa cada JSON y limpia. */
  async procesarArchivoLocal(ruta7z: string): Promise<ResumenEtl> {
    const dirTemporal = await mkdtemp(join(tmpdir(), PREFIJO_TMP));
    try {
      await unpack(ruta7z, dirTemporal);
      const archivos = (await readdir(dirTemporal, { recursive: true }))
        .filter((nombre) => nombre.endsWith(EXTENSION_JSON))
        .map((nombre) => join(dirTemporal, nombre));

      const resumen = { leidos: 0, upsertados: 0, descartados: 0 };
      for (const archivo of archivos) {
        const parcial = await this.procesarArchivoJson(archivo);
        resumen.leidos += parcial.leidos;
        resumen.upsertados += parcial.upsertados;
        resumen.descartados += parcial.descartados;
      }
      this.logger.log(
        `Bulk OCDS ${ruta7z}: ${resumen.upsertados} upsertados, ${resumen.descartados} descartados de ${resumen.leidos}`,
      );
      return resumen;
    } finally {
      await rm(dirTemporal, { recursive: true, force: true });
    }
  }

  private async procesarArchivoJson(ruta: string): Promise<ResumenEtl> {
    const contenido = await readFile(ruta, 'utf-8');
    // unknown: el dump externo no tiene contrato garantizado; el mapper valida.
    const paquete = JSON.parse(contenido) as Parameters<
      typeof extraerReleases
    >[0];
    const releases = extraerReleases(paquete);

    const resumen = { leidos: releases.length, upsertados: 0, descartados: 0 };
    // Secuencial a propósito: M0 limita a ~100 ops/s, sin paralelismo.
    for (const release of releases) {
      const normalizada = normalizarReleaseOcds(release);
      if (normalizada === null) {
        resumen.descartados += 1;
        continue;
      }
      await this.repository.upsertByCodigoExterno(
        normalizada.codigoExterno,
        normalizada,
      );
      resumen.upsertados += 1;
    }
    return resumen;
  }
}
