const RUT_NORMALIZADO_REGEX = /^(\d{1,8})-([\dK])$/;
const MODULO_11 = 11;
const FACTOR_MIN = 2;
const FACTOR_MAX = 7;

const calcularDigitoVerificador = (cuerpo: string): string => {
  const { suma } = [...cuerpo].reverse().reduce(
    (acc, digito) => ({
      suma: acc.suma + Number(digito) * acc.factor,
      factor: acc.factor === FACTOR_MAX ? FACTOR_MIN : acc.factor + 1,
    }),
    { suma: 0, factor: FACTOR_MIN },
  );
  const resto = MODULO_11 - (suma % MODULO_11);
  if (resto === MODULO_11) {
    return '0';
  }
  if (resto === 10) {
    return 'K';
  }
  return String(resto);
};

/**
 * Normaliza un RUT chileno a formato estándar `NNNNNNNN-D` (sin puntos,
 * dígito verificador en mayúscula). Los archivos OCDS de ChileCompra traen
 * formatos inconsistentes: con puntos, sin guión, dv en minúscula.
 * Retorna null si el formato es irrecuperable o el dv no cuadra (módulo 11).
 */
export const normalizarRut = (entrada: string): string | null => {
  const limpio = entrada.replace(/[.\s]/g, '').toUpperCase();
  const conGuion = limpio.includes('-')
    ? limpio
    : `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;

  const coincidencia = RUT_NORMALIZADO_REGEX.exec(conGuion);
  if (!coincidencia) {
    return null;
  }

  const [, cuerpo, digitoVerificador] = coincidencia;
  const dvEsperado = calcularDigitoVerificador(cuerpo);
  if (digitoVerificador !== dvEsperado) {
    return null;
  }
  return `${cuerpo}-${digitoVerificador}`;
};
