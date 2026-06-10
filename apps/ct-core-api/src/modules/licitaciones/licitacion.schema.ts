import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LicitacionDocument = HydratedDocument<Licitacion>;

export const LICITACION_ESTADOS = {
  PUBLICADA: 'publicada',
  CERRADA: 'cerrada',
  DESIERTA: 'desierta',
  ADJUDICADA: 'adjudicada',
  REVOCADA: 'revocada',
  SUSPENDIDA: 'suspendida',
  ARCHIVADA: 'archivado',
} as const;

export type LicitacionEstado =
  (typeof LICITACION_ESTADOS)[keyof typeof LICITACION_ESTADOS];

export const LICITACION_FUENTES = {
  API: 'api',
  OCDS: 'ocds',
  COMPRA_AGIL: 'compra-agil',
} as const;

export type LicitacionFuente =
  (typeof LICITACION_FUENTES)[keyof typeof LICITACION_FUENTES];

const MESES_RETENCION_ARCHIVADO = 18;
const SEGUNDOS_POR_MES = 30 * 24 * 60 * 60;
const TTL_ARCHIVADO_SEGUNDOS = MESES_RETENCION_ARCHIVADO * SEGUNDOS_POR_MES;

@Schema({ timestamps: true, collection: 'licitaciones' })
export class Licitacion {
  @Prop({ unique: true, required: true, index: true })
  declare codigoExterno: string;

  @Prop({ required: true })
  declare nombre: string;

  @Prop({ required: true })
  declare estado: LicitacionEstado;

  @Prop({ type: String })
  declare descripcion: string | undefined;

  @Prop({ type: String, index: true })
  declare codigoOrganismo: string | undefined;

  @Prop({ type: String })
  declare nombreOrganismo: string | undefined;

  @Prop({ type: String })
  declare region: string | undefined;

  @Prop({ type: Number })
  declare montoEstimado: number | undefined;

  @Prop({ type: Date })
  declare fechaPublicacion: Date | undefined;

  @Prop({ type: Date, index: true })
  declare fechaCierre: Date | undefined;

  @Prop({ type: Object })
  declare rawData: Record<string, unknown> | undefined;

  @Prop({ type: Number, min: 0, max: 1 })
  declare dataQualityScore: number | undefined;

  @Prop({ type: String, default: LICITACION_FUENTES.API, index: true })
  declare fuente: LicitacionFuente;
}

export const LicitacionSchema = SchemaFactory.createForClass(Licitacion);

LicitacionSchema.index({ estado: 1, fechaCierre: 1 });
LicitacionSchema.index({ codigoOrganismo: 1, estado: 1 });

// TTL crítico para MongoDB M0 (512 MB): archivados se purgan a los 18 meses.
LicitacionSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: TTL_ARCHIVADO_SEGUNDOS,
    partialFilterExpression: { estado: LICITACION_ESTADOS.ARCHIVADA },
  },
);
