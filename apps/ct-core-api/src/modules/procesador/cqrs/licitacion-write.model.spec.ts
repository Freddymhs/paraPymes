import { ValidationError } from '@common/exceptions';
import { LicitacionesRepository } from '@modules/licitaciones/licitaciones.repository';
import { LicitacionWriteModel } from './licitacion-write.model';

const PAYLOAD_VALIDO = {
  codigoExterno: '1234-56-LE26',
  nombre: 'Licitación de prueba',
  estado: 'publicada',
};

describe('LicitacionWriteModel', () => {
  const crearModelo = () => {
    const repository = {
      upsertByCodigoExterno: jest.fn().mockResolvedValue(PAYLOAD_VALIDO),
    };
    const modelo = new LicitacionWriteModel(
      repository as unknown as LicitacionesRepository,
    );
    return { modelo, repository };
  };

  it('persiste payload válido vía upsert idempotente', async () => {
    const { modelo, repository } = crearModelo();

    await modelo.persistir({ ...PAYLOAD_VALIDO });

    expect(repository.upsertByCodigoExterno).toHaveBeenCalledWith(
      PAYLOAD_VALIDO.codigoExterno,
      expect.objectContaining({ nombre: PAYLOAD_VALIDO.nombre }),
    );
  });

  it('rechaza payload sin codigoExterno', async () => {
    const { modelo, repository } = crearModelo();

    await expect(
      modelo.persistir({ nombre: 'x', estado: 'publicada' }),
    ).rejects.toThrow(ValidationError);
    expect(repository.upsertByCodigoExterno).not.toHaveBeenCalled();
  });

  it('rechaza estado fuera del enum de dominio', async () => {
    const { modelo, repository } = crearModelo();

    await expect(
      modelo.persistir({ ...PAYLOAD_VALIDO, estado: 'inexistente' }),
    ).rejects.toThrow(ValidationError);
    expect(repository.upsertByCodigoExterno).not.toHaveBeenCalled();
  });
});
