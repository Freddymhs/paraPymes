import { Injectable } from '@nestjs/common';
import { ValidationError } from '@common/exceptions';
import { LicitacionesRepository } from '@modules/licitaciones/licitaciones.repository';
import {
  LicitacionDocument,
  LICITACION_ESTADOS,
} from '@modules/licitaciones/licitacion.schema';

const ESTADOS_VALIDOS = new Set<string>(Object.values(LICITACION_ESTADOS));

/**
 * Lado write del CQRS: valida el payload entrante y persiste idempotente.
 * La unicidad la garantiza el índice único de `codigoExterno` en MongoDB.
 */
@Injectable()
export class LicitacionWriteModel {
  constructor(private readonly repository: LicitacionesRepository) {}

  async persistir(
    payload: Record<string, unknown>,
  ): Promise<LicitacionDocument> {
    const { codigoExterno, nombre, estado } = payload;
    if (typeof codigoExterno !== 'string' || codigoExterno === '') {
      throw new ValidationError('Payload sin codigoExterno');
    }
    if (typeof nombre !== 'string' || nombre === '') {
      throw new ValidationError(`Payload ${codigoExterno} sin nombre`);
    }
    if (typeof estado !== 'string' || !ESTADOS_VALIDOS.has(estado)) {
      throw new ValidationError(
        `Payload ${codigoExterno} con estado inválido: ${String(estado)}`,
      );
    }

    // Validados los campos mínimos, el resto del payload ya es dominio.
    return this.repository.upsertByCodigoExterno(codigoExterno, payload);
  }
}
