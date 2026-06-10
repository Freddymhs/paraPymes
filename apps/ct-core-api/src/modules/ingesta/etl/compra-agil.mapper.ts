import {
  LICITACION_ESTADOS,
  LICITACION_FUENTES,
} from '@modules/licitaciones/licitacion.schema';
import { normalizarRut } from '@common/utils';
import { LicitacionNormalizada } from '../normalizacion/licitacion.mapper';
import { calcularDataQualityScore } from '../normalizacion/data-quality';

export type FilaCsv = Record<string, string>;

/**
 * Encabezados candidatos por campo: los CSV de datos-abiertos.chilecompra.cl
 * no tienen contrato estable entre periodos — se prueba en orden.
 */
const COLUMNAS_CANDIDATAS = {
  codigoExterno: ['Codigo', 'CodigoOC', 'ID', 'NroOrdenCompra'],
  nombre: ['Nombre', 'NombreOC', 'Descripcion'],
  descripcion: ['Descripcion', 'DescripcionOC'],
  nombreOrganismo: ['Organismo', 'NombreOrganismo', 'Institucion'],
  codigoOrganismo: ['RutUnidadCompra', 'RutOrganismo', 'CodigoOrganismo'],
  region: ['Region', 'RegionUnidadCompra'],
  montoEstimado: ['MontoTotal', 'TotalNeto', 'Monto'],
  fechaPublicacion: ['FechaEnvio', 'FechaCreacion', 'Fecha'],
} as const;

const leerColumna = (
  fila: FilaCsv,
  candidatas: readonly string[],
): string | undefined => {
  const columna = candidatas.find(
    (nombre) => fila[nombre] !== undefined && fila[nombre].trim() !== '',
  );
  return columna === undefined ? undefined : fila[columna].trim();
};

const leerMonto = (valor: string | undefined): number | undefined => {
  if (valor === undefined) {
    return undefined;
  }
  const numero = Number(valor.replace(/[.$\s]/g, '').replace(',', '.'));
  return Number.isFinite(numero) ? numero : undefined;
};

const leerFecha = (valor: string | undefined): Date | undefined => {
  if (valor === undefined) {
    return undefined;
  }
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
};

/** Null si la fila no trae código u nombre — el caller cuenta descartes. */
export const normalizarFilaCompraAgil = (
  fila: FilaCsv,
): LicitacionNormalizada | null => {
  const codigoExterno = leerColumna(fila, COLUMNAS_CANDIDATAS.codigoExterno);
  const nombre = leerColumna(fila, COLUMNAS_CANDIDATAS.nombre);
  if (codigoExterno === undefined || nombre === undefined) {
    return null;
  }

  const rutOrganismo = leerColumna(fila, COLUMNAS_CANDIDATAS.codigoOrganismo);
  const normalizada: LicitacionNormalizada = {
    codigoExterno,
    nombre,
    // Compra Ágil = orden de compra ya emitida: nace adjudicada.
    estado: LICITACION_ESTADOS.ADJUDICADA,
    descripcion: leerColumna(fila, COLUMNAS_CANDIDATAS.descripcion),
    nombreOrganismo: leerColumna(fila, COLUMNAS_CANDIDATAS.nombreOrganismo),
    codigoOrganismo:
      rutOrganismo === undefined
        ? undefined
        : (normalizarRut(rutOrganismo) ?? rutOrganismo),
    region: leerColumna(fila, COLUMNAS_CANDIDATAS.region),
    montoEstimado: leerMonto(
      leerColumna(fila, COLUMNAS_CANDIDATAS.montoEstimado),
    ),
    fechaPublicacion: leerFecha(
      leerColumna(fila, COLUMNAS_CANDIDATAS.fechaPublicacion),
    ),
    fuente: LICITACION_FUENTES.COMPRA_AGIL,
  };
  return {
    ...normalizada,
    dataQualityScore: calcularDataQualityScore(normalizada),
  };
};
