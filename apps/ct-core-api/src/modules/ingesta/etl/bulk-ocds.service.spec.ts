import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LicitacionesRepository } from '@modules/licitaciones/licitaciones.repository';
import { BulkOcdsService } from './bulk-ocds.service';

const PAQUETE_OCDS = {
  releases: [
    {
      tender: {
        id: '1234-56-LE26',
        title: 'Compra de prueba',
        status: 'active',
      },
    },
    // Sin título → descartado por el mapper.
    { tender: { id: '9999-99-LE26', status: 'active' } },
  ],
};

jest.mock('7zip-min', () => ({
  unpack: jest.fn(async (_ruta7z: string, destino: string) => {
    await writeFile(
      join(destino, 'releases.json'),
      JSON.stringify(PAQUETE_OCDS),
    );
    return '';
  }),
}));

describe('BulkOcdsService', () => {
  it('descomprime, normaliza y upserta releases válidos', async () => {
    const repository = {
      upsertByCodigoExterno: jest.fn().mockResolvedValue({}),
    };
    const servicio = new BulkOcdsService(
      repository as unknown as LicitacionesRepository,
    );

    const resumen = await servicio.procesarArchivoLocal('/tmp/dump.7z');

    expect(resumen).toEqual({ leidos: 2, upsertados: 1, descartados: 1 });
    expect(repository.upsertByCodigoExterno).toHaveBeenCalledWith(
      '1234-56-LE26',
      expect.objectContaining({ fuente: 'ocds' }),
    );
  });
});
