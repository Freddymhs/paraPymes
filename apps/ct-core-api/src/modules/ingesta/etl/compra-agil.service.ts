import { createReadStream } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import { parse } from 'csv-parse';
import { LicitacionesRepository } from '@modules/licitaciones/licitaciones.repository';
import { FilaCsv, normalizarFilaCompraAgil } from './compra-agil.mapper';
import { ResumenEtl } from './bulk-ocds.service';

/**
 * ETL mensual de Compra Ágil (30–40% del mercado público). NO existe en la
 * API REST — solo CSV de datos-abiertos.chilecompra.cl. Se ejecuta manual
 * en off-hours con el archivo ya descargado, mismo ciclo que el bulk OCDS.
 */
@Injectable()
export class CompraAgilService {
  private readonly logger = new Logger(CompraAgilService.name);

  constructor(private readonly repository: LicitacionesRepository) {}

  /** Streaming fila a fila: los CSV mensuales superan la RAM disponible. */
  async procesarArchivoLocal(rutaCsv: string): Promise<ResumenEtl> {
    const filas = createReadStream(rutaCsv).pipe(
      parse({
        columns: true,
        bom: true,
        delimiter: [';', ','],
        skipEmptyLines: true,
        trim: true,
        relaxColumnCount: true,
      }),
    );

    const resumen = { leidos: 0, upsertados: 0, descartados: 0 };
    // Secuencial a propósito: M0 limita a ~100 ops/s, sin paralelismo.
    for await (const fila of filas as AsyncIterable<FilaCsv>) {
      resumen.leidos += 1;
      const normalizada = normalizarFilaCompraAgil(fila);
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
    this.logger.log(
      `Compra Ágil ${rutaCsv}: ${resumen.upsertados} upsertados, ${resumen.descartados} descartados de ${resumen.leidos}`,
    );
    return resumen;
  }
}
