import {
  LICITACION_ESTADOS,
  LICITACION_FUENTES,
} from '@modules/licitaciones/licitacion.schema';
import { normalizarLicitacion } from './licitacion.mapper';
import { LicitacionRaw } from '../clients/chilecompra-api.client';

const RAW_BASE: LicitacionRaw = {
  CodigoExterno: '1234-56-LE26',
  Nombre: 'Adquisición de insumos',
  CodigoEstado: 5,
  FechaCierre: '2026-07-01T15:00:00',
};

describe('normalizarLicitacion', () => {
  it('mapea campos mínimos y marca fuente api', () => {
    const resultado = normalizarLicitacion(RAW_BASE);

    expect(resultado).toMatchObject({
      codigoExterno: RAW_BASE.CodigoExterno,
      nombre: RAW_BASE.Nombre,
      estado: LICITACION_ESTADOS.PUBLICADA,
      fuente: LICITACION_FUENTES.API,
    });
    expect(resultado?.fechaCierre).toBeInstanceOf(Date);
    expect(resultado?.rawData).toEqual(RAW_BASE);
  });

  it('mapea todos los códigos de estado conocidos', () => {
    const casos: ReadonlyArray<[number, string]> = [
      [5, LICITACION_ESTADOS.PUBLICADA],
      [6, LICITACION_ESTADOS.CERRADA],
      [7, LICITACION_ESTADOS.DESIERTA],
      [8, LICITACION_ESTADOS.ADJUDICADA],
      [15, LICITACION_ESTADOS.REVOCADA],
      [16, LICITACION_ESTADOS.SUSPENDIDA],
    ];
    for (const [codigo, esperado] of casos) {
      const resultado = normalizarLicitacion({
        ...RAW_BASE,
        CodigoEstado: codigo,
      });
      expect(resultado?.estado).toBe(esperado);
    }
  });

  it('retorna null ante estado desconocido o campos mínimos faltantes', () => {
    expect(normalizarLicitacion({ ...RAW_BASE, CodigoEstado: 999 })).toBeNull();
    expect(normalizarLicitacion({ ...RAW_BASE, CodigoExterno: '' })).toBeNull();
    expect(normalizarLicitacion({ ...RAW_BASE, Nombre: '' })).toBeNull();
  });

  it('descarta opcionales malformados sin romper', () => {
    const resultado = normalizarLicitacion({
      ...RAW_BASE,
      FechaCierre: 'no-es-fecha',
      MontoEstimado: 'texto',
    });

    expect(resultado?.fechaCierre).toBeUndefined();
    expect(resultado?.montoEstimado).toBeUndefined();
  });
});
