import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MensajeFallidoDocument = HydratedDocument<MensajeFallido>;

const DIAS_RETENCION_FALLIDOS = 90;
const TTL_FALLIDOS_SEGUNDOS = DIAS_RETENCION_FALLIDOS * 24 * 60 * 60;

@Schema({ timestamps: true, collection: 'mensajes_fallidos' })
export class MensajeFallido {
  @Prop({ type: String, index: true })
  declare sqsMessageId: string | undefined;

  @Prop({ required: true })
  declare body: string;

  @Prop({ required: true })
  declare razon: string;
}

export const MensajeFallidoSchema =
  SchemaFactory.createForClass(MensajeFallido);

// Debugging temporal, no histórico: se purgan a los 90 días (MongoDB M0).
MensajeFallidoSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: TTL_FALLIDOS_SEGUNDOS },
);
