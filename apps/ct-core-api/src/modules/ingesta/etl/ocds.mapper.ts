import {
  LicitacionEstado,
  LICITACION_ESTADOS,
  LICITACION_FUENTES,
} from '@modules/licitaciones/licitacion.schema';
import { normalizarRut } from '@common/utils';
import { LicitacionNormalizada } from '../normalizacion/licitacion.mapper';
import { calcularDataQualityScore } from '../normalizacion/data-quality';

/** Release OCDS (esquema datos-abiertos.chilecompra.cl). Campos defensivos. */
export interface OcdsRelease {
  readonly ocid?: string;
  readonly tender?: {
    readonly id?: string;
    readonly title?: string;
    readonly description?: string;
    readonly status?: string;
    readonly value?: { readonly amount?: number };
    readonly tenderPeriod?: {
      readonly startDate?: string;
      readonly endDate?: string;
    };
    readonly procuringEntity?: { readonly id?: string; readonly name?: string };
  };
  readonly [campo: string]: unknown;
}

/** Paquetes OCDS: release package (releases) o record package (records). */
interface PaqueteOcds {
  readonly releases?: OcdsRelease[];
  readonly records?: Array<{ readonly compiledRelease?: OcdsRelease }>;
}

/** Estados estándar OCDS → estados del dominio. */
const OCDS_ESTADO_MAP: Record<string, LicitacionEstado> = {
  active: LICITACION_ESTADOS.PUBLICADA,
  complete: LICITACION_ESTADOS.ADJUDICADA,
  cancelled: LICITACION_ESTADOS.REVOCADA,
  unsuccessful: LICITACION_ESTADOS.DESIERTA,
  withdrawn: LICITACION_ESTADOS.SUSPENDIDA,
};

const leerFecha = (valor: string | undefined): Date | undefined => {
  if (valor === undefined) {
    return undefined;
  }
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
};

/** IDs OCDS de organismos vienen como `CL-MP-<rut>` o RUT crudo. */
const normalizarCodigoOrganismo = (
  id: string | undefined,
): string | undefined => {
  if (id === undefined || id === '') {
    return undefined;
  }
  const posibleRut = id.split('-MP-').pop() ?? id;
  return normalizarRut(posibleRut) ?? id;
};

export const extraerReleases = (paquete: PaqueteOcds): OcdsRelease[] => {
  if (paquete.releases !== undefined) {
    return paquete.releases;
  }
  return (paquete.records ?? [])
    .map((registro) => registro.compiledRelease)
    .filter((release): release is OcdsRelease => release !== undefined);
};

/** Null si faltan campos mínimos o el estado OCDS es desconocido. */
export const normalizarReleaseOcds = (
  release: OcdsRelease,
): LicitacionNormalizada | null => {
  const { ocid, tender } = release;
  const codigoExterno = tender?.id ?? ocid;
  const nombre = tender?.title;
  const estado = OCDS_ESTADO_MAP[tender?.status ?? ''] as
    | LicitacionEstado
    | undefined;
  if (!codigoExterno || !nombre || estado === undefined) {
    return null;
  }

  const normalizada: LicitacionNormalizada = {
    codigoExterno,
    nombre,
    estado,
    descripcion: tender?.description,
    codigoOrganismo: normalizarCodigoOrganismo(tender?.procuringEntity?.id),
    nombreOrganismo: tender?.procuringEntity?.name,
    montoEstimado: tender?.value?.amount,
    fechaPublicacion: leerFecha(tender?.tenderPeriod?.startDate),
    fechaCierre: leerFecha(tender?.tenderPeriod?.endDate),
    fuente: LICITACION_FUENTES.OCDS,
  };
  return {
    ...normalizada,
    dataQualityScore: calcularDataQualityScore(normalizada),
  };
};
