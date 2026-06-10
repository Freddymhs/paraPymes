import { Licitacion } from '@modules/licitaciones/licitacion.schema';

/**
 * Campos opcionales que aportan valor de negocio. Los obligatorios
 * (codigoExterno, nombre, estado) no puntúan: sin ellos no hay registro.
 */
const CAMPOS_CALIDAD: ReadonlyArray<keyof Licitacion> = [
  'descripcion',
  'codigoOrganismo',
  'nombreOrganismo',
  'region',
  'montoEstimado',
  'fechaPublicacion',
  'fechaCierre',
];

const DECIMALES_SCORE = 2;

/** Completitud de campos clave, entre 0 y 1. */
export const calcularDataQualityScore = (
  licitacion: Partial<Licitacion>,
): number => {
  const presentes = CAMPOS_CALIDAD.filter(
    (campo) => licitacion[campo] !== undefined && licitacion[campo] !== null,
  ).length;
  return Number((presentes / CAMPOS_CALIDAD.length).toFixed(DECIMALES_SCORE));
};
