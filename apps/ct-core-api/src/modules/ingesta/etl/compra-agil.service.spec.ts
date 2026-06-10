import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LicitacionesRepository } from '@modules/licitaciones/licitaciones.repository';
import { CompraAgilService } from './compra-agil.service';

const CSV_COMPRA_AGIL = [
  'Codigo;Nombre;Organismo;RutUnidadCompra;MontoTotal;FechaEnvio',
  '12345-AG-26;Compra de notebooks;Municipalidad de Temuco;69.190.700-7;1500000;2026-03-01',
  ';Fila sin codigo;Organismo X;;;',
].join('\n');

describe('CompraAgilService', () => {
  const crearCsvTemporal = async (): Promise<{
    ruta: string;
    limpiar: () => Promise<void>;
  }> => {
    const dir = await mkdtemp(join(tmpdir(), 'compra-agil-spec-'));
    const ruta = join(dir, 'compra-agil.csv');
    await writeFile(ruta, CSV_COMPRA_AGIL);
    return { ruta, limpiar: () => rm(dir, { recursive: true, force: true }) };
  };

  it('parsea CSV streaming, normaliza y upserta con fuente compra-agil', async () => {
    const { ruta, limpiar } = await crearCsvTemporal();
    const repository = {
      upsertByCodigoExterno: jest.fn().mockResolvedValue({}),
    };
    const servicio = new CompraAgilService(
      repository as unknown as LicitacionesRepository,
    );

    try {
      const resumen = await servicio.procesarArchivoLocal(ruta);

      expect(resumen).toEqual({ leidos: 2, upsertados: 1, descartados: 1 });
      expect(repository.upsertByCodigoExterno).toHaveBeenCalledWith(
        '12345-AG-26',
        expect.objectContaining({
          fuente: 'compra-agil',
          estado: 'adjudicada',
          codigoOrganismo: '69190700-7',
          montoEstimado: 1_500_000,
        }),
      );
    } finally {
      await limpiar();
    }
  });
});
