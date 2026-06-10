import {
  Licitacion,
  LicitacionEstado,
  LICITACION_ESTADOS,
  LICITACION_FUENTES,
} from '@modules/licitaciones/licitacion.schema';
import { LicitacionRaw } from '../clients/chilecompra-api.client';

/** Códigos de estado oficiales de la API ChileCompra → estados del dominio. */
const CODIGO_ESTADO_MAP: Record<number, LicitacionEstado> = {
  5: LICITACION_ESTADOS.PUBLICADA,
  6: LICITACION_ESTADOS.CERRADA,
  7: LICITACION_ESTADOS.DESIERTA,
  8: LICITACION_ESTADOS.ADJUDICADA,
  15: LICITACION_ESTADOS.REVOCADA,
  16: LICITACION_ESTADOS.SUSPENDIDA,
};

const leerString = (raw: LicitacionRaw, campo: string): string | undefined => {
  const valor = raw[campo];
  return typeof valor === 'string' && valor !== '' ? valor : undefined;
};

const leerNumber = (raw: LicitacionRaw, campo: string): number | undefined => {
  const valor = raw[campo];
  return typeof valor === 'number' && Number.isFinite(valor)
    ? valor
    : undefined;
};

const leerFecha = (raw: LicitacionRaw, campo: string): Date | undefined => {
  const valor = raw[campo];
  if (typeof valor !== 'string') {
    return undefined;
  }
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
};

/** Normalización con los campos mínimos del dominio garantizados. */
export type LicitacionNormalizada = Partial<Licitacion> & {
  codigoExterno: string;
  nombre: string;
  estado: LicitacionEstado;
};

/**
 * Normaliza el esquema crudo de la API al dominio. Retorna null si faltan
 * campos mínimos o el estado es desconocido — el caller decide loguear/saltar.
 */
export const normalizarLicitacion = (
  raw: LicitacionRaw,
): LicitacionNormalizada | null => {
  const { CodigoExterno, Nombre, CodigoEstado } = raw;
  const estado = CODIGO_ESTADO_MAP[CodigoEstado] as
    | LicitacionEstado
    | undefined;
  const esRegistroValido =
    Boolean(CodigoExterno) && Boolean(Nombre) && estado !== undefined;
  if (!esRegistroValido || estado === undefined) {
    return null;
  }

  return {
    codigoExterno: CodigoExterno,
    nombre: Nombre,
    estado,
    descripcion: leerString(raw, 'Descripcion'),
    codigoOrganismo: leerString(raw, 'CodigoOrganismo'),
    nombreOrganismo: leerString(raw, 'NombreOrganismo'),
    region: leerString(raw, 'RegionUnidad'),
    montoEstimado: leerNumber(raw, 'MontoEstimado'),
    fechaPublicacion: leerFecha(raw, 'FechaPublicacion'),
    fechaCierre: leerFecha(raw, 'FechaCierre'),
    fuente: LICITACION_FUENTES.API,
    rawData: raw,
  };
};
