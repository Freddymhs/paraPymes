import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Licitacion,
  LicitacionDocument,
  LicitacionEstado,
} from '@modules/licitaciones/licitacion.schema';

/** Proyección desnormalizada para el dashboard de ct-core-web. */
export interface LicitacionVistaDashboard {
  readonly codigoExterno: string;
  readonly nombre: string;
  readonly estado: LicitacionEstado;
  readonly nombreOrganismo?: string;
  readonly region?: string;
  readonly montoEstimado?: number;
  readonly fechaCierre?: Date;
}

const CAMPOS_DASHBOARD =
  'codigoExterno nombre estado nombreOrganismo region montoEstimado fechaCierre';
const LIMITE_DASHBOARD_DEFAULT = 50;

/**
 * Lado read del CQRS: queries lean para vistas, sin pasar por el write model.
 * Sobre la misma colección — en MongoDB M0 (512 MB) duplicar colecciones
 * de lectura costaría más storage del que ahorra en latencia.
 */
@Injectable()
export class LicitacionReadModel {
  constructor(
    @InjectModel(Licitacion.name)
    private readonly model: Model<LicitacionDocument>,
  ) {}

  async vistaDashboard(
    estado: LicitacionEstado,
    limite: number = LIMITE_DASHBOARD_DEFAULT,
  ): Promise<LicitacionVistaDashboard[]> {
    return this.model
      .find({ estado })
      .select(CAMPOS_DASHBOARD)
      .sort({ fechaCierre: 1 })
      .limit(limite)
      .lean<LicitacionVistaDashboard[]>()
      .exec();
  }
}
