import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClaimCheckService, MENSAJE_TIPOS } from './claim-check.service';
import { S3_CLIENT } from '../aws/aws.providers';

const BUCKET_TEST = 'ct-payloads-test';
const FECHA_ISO = '2026-06-09';
const CODIGO = '1234-56-LE26';
const UMBRAL_BYTES = 200_000;

const createService = async (s3SendMock: jest.Mock) => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ClaimCheckService,
      { provide: S3_CLIENT, useValue: { send: s3SendMock } },
      {
        provide: ConfigService,
        useValue: { getOrThrow: jest.fn().mockReturnValue(BUCKET_TEST) },
      },
    ],
  }).compile();
  return module.get<ClaimCheckService>(ClaimCheckService);
};

describe('ClaimCheckService', () => {
  it('payload chico pasa directo sin tocar S3', async () => {
    const s3Send = jest.fn();
    const service = await createService(s3Send);
    const payload = { codigoExterno: CODIGO };

    const mensaje = await service.envolver(FECHA_ISO, CODIGO, payload);

    expect(mensaje).toEqual({ type: MENSAJE_TIPOS.LICITACION, payload });
    expect(s3Send).not.toHaveBeenCalled();
  });

  it('payload > umbral sube a S3 y retorna pointer', async () => {
    const s3Send = jest.fn().mockResolvedValue({});
    const service = await createService(s3Send);
    const payload = { relleno: 'x'.repeat(UMBRAL_BYTES + 1) };

    const mensaje = await service.envolver(FECHA_ISO, CODIGO, payload);

    expect(mensaje).toEqual({
      type: MENSAJE_TIPOS.CLAIM_CHECK,
      s3Key: `licitaciones/${FECHA_ISO}/${CODIGO}.json`,
    });
    expect(s3Send).toHaveBeenCalledTimes(1);
  });

  it('resolver descarga y parsea el claim-check desde S3', async () => {
    const contenido = { codigoExterno: CODIGO, nombre: 'Test' };
    const s3Send = jest.fn().mockResolvedValue({
      Body: {
        transformToString: () => Promise.resolve(JSON.stringify(contenido)),
      },
    });
    const service = await createService(s3Send);

    const resultado = await service.resolver({
      type: MENSAJE_TIPOS.CLAIM_CHECK,
      s3Key: 'licitaciones/x.json',
    });

    expect(resultado).toEqual(contenido);
  });

  it('resolver retorna payload inline para mensajes directos', async () => {
    const service = await createService(jest.fn());
    const payload = { codigoExterno: CODIGO };

    await expect(
      service.resolver({ type: MENSAJE_TIPOS.LICITACION, payload }),
    ).resolves.toEqual(payload);
  });
});
