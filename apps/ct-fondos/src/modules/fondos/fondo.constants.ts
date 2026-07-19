export const ESTADO_FONDO = {
  ABIERTO: 'abierto',
  CERRADO: 'cerrado',
} as const;

export type EstadoFondo = (typeof ESTADO_FONDO)[keyof typeof ESTADO_FONDO];
