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
} as const;

export type LicitacionEstado =
  (typeof LICITACION_ESTADOS)[keyof typeof LICITACION_ESTADOS];

@Schema({ timestamps: true, collection: 'licitaciones' })
export class Licitacion {
  @Prop({ unique: true, required: true, index: true })
  declare codigoExterno: string;

  @Prop({ required: true })
  declare nombre: string;

  @Prop({ required: true })
  declare estado: LicitacionEstado;

  @Prop()
  declare descripcion: string | undefined;

  @Prop({ index: true })
  declare codigoOrganismo: string | undefined;

  @Prop()
  declare nombreOrganismo: string | undefined;

  @Prop()
  declare region: string | undefined;

  @Prop({ type: Number })
  declare montoEstimado: number | undefined;

  @Prop()
  declare fechaPublicacion: Date | undefined;

  @Prop({ index: true })
  declare fechaCierre: Date | undefined;

  @Prop({ type: Object })
  declare rawData: Record<string, unknown> | undefined;
}

export const LicitacionSchema = SchemaFactory.createForClass(Licitacion);

LicitacionSchema.index({ estado: 1, fechaCierre: 1 });
LicitacionSchema.index({ codigoOrganismo: 1, estado: 1 });
