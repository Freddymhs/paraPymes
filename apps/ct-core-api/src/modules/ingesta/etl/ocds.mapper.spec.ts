import {
  LICITACION_ESTADOS,
  LICITACION_FUENTES,
} from '@modules/licitaciones/licitacion.schema';
import {
  extraerReleases,
  normalizarReleaseOcds,
  OcdsRelease,
} from './ocds.mapper';

const RELEASE_COMPLETO: OcdsRelease = {
  ocid: 'ocds-70d2nz-1234-56-LE26',
  tender: {
    id: '1234-56-LE26',
    title: 'Suministro de insumos médicos',
    description: 'Detalle de la compra',
    status: 'active',
    value: { amount: 5_000_000 },
    tenderPeriod: {
      startDate: '2026-01-10T15:00:00Z',
      endDate: '2026-02-10T15:00:00Z',
    },
    procuringEntity: { id: 'CL-MP-61.602.123-0', name: 'Hospital Regional' },
  },
};

describe('normalizarReleaseOcds', () => {
  it('mapea release completo con fuente ocds y score de calidad', () => {
    const resultado = normalizarReleaseOcds(RELEASE_COMPLETO);

    expect(resultado).toMatchObject({
      codigoExterno: '1234-56-LE26',
      nombre: 'Suministro de insumos médicos',
      estado: LICITACION_ESTADOS.PUBLICADA,
      fuente: LICITACION_FUENTES.OCDS,
      montoEstimado: 5_000_000,
    });
    expect(resultado?.dataQualityScore).toBeGreaterThan(0.8);
  });

  it('normaliza RUT del organismo desde el id OCDS', () => {
    const resultado = normalizarReleaseOcds(RELEASE_COMPLETO);

    expect(resultado?.codigoOrganismo).toBe('61602123-0');
  });

  it('descarta release sin tender.title', () => {
    const sinTitulo: OcdsRelease = {
      ocid: 'x',
      tender: { id: 'x', status: 'active' },
    };
    expect(normalizarReleaseOcds(sinTitulo)).toBeNull();
  });

  it('descarta estado OCDS desconocido', () => {
    const estadoRaro: OcdsRelease = {
      tender: { id: 'x', title: 'y', status: 'planning' },
    };
    expect(normalizarReleaseOcds(estadoRaro)).toBeNull();
  });
});

describe('extraerReleases', () => {
  it('lee release packages y record packages', () => {
    expect(extraerReleases({ releases: [RELEASE_COMPLETO] })).toHaveLength(1);
    expect(
      extraerReleases({ records: [{ compiledRelease: RELEASE_COMPLETO }, {}] }),
    ).toHaveLength(1);
  });
});
