import { Test, TestingModule } from '@nestjs/testing';
import { IngestaService } from './ingesta.service';
import { ChileCompraBreaker } from './circuit-breaker/chilecompra.breaker';
import { SqsPublisherService } from './sqs/sqs-publisher.service';
import { LicitacionRaw } from './clients/chilecompra-api.client';

const FECHA_ISO = '2026-06-09';

const rawValida = (codigo: string): LicitacionRaw => ({
  CodigoExterno: codigo,
  Nombre: `Licitación ${codigo}`,
  CodigoEstado: 5,
  FechaCierre: null,
});

const createService = async (
  licitaciones: LicitacionRaw[],
  publicarMock: jest.Mock,
) => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      IngestaService,
      {
        provide: ChileCompraBreaker,
        useValue: {
          getLicitacionesByFecha: jest.fn().mockResolvedValue(licitaciones),
        },
      },
      {
        provide: SqsPublisherService,
        useValue: { publicarLicitaciones: publicarMock },
      },
    ],
  }).compile();
  return module.get<IngestaService>(IngestaService);
};

describe('IngestaService', () => {
  it('normaliza y publica licitaciones válidas, reporta resumen', async () => {
    const publicar = jest
      .fn()
      .mockResolvedValue({ publicadas: 2, fallidas: 0 });
    const service = await createService(
      [rawValida('A-1'), rawValida('B-2')],
      publicar,
    );

    const resumen = await service.ingestarFecha(FECHA_ISO);

    expect(resumen).toEqual({
      recibidas: 2,
      publicadas: 2,
      fallidas: 0,
      descartadas: 0,
    });
    expect(publicar).toHaveBeenCalledWith(
      FECHA_ISO,
      expect.arrayContaining([
        expect.objectContaining({ codigoExterno: 'A-1' }),
      ]),
    );
  });

  it('descarta inválidas y no publica si no queda ninguna', async () => {
    const publicar = jest.fn();
    const invalida = { ...rawValida('X-9'), CodigoEstado: 999 };
    const service = await createService([invalida], publicar);

    const resumen = await service.ingestarFecha(FECHA_ISO);

    expect(resumen).toEqual({
      recibidas: 1,
      publicadas: 0,
      fallidas: 0,
      descartadas: 1,
    });
    expect(publicar).not.toHaveBeenCalled();
  });
});
