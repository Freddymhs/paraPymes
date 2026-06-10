import { Test, TestingModule } from '@nestjs/testing';
import { ChileCompraBreaker } from './chilecompra.breaker';
import { ChileCompraApiClient } from '../clients/chilecompra-api.client';

const FECHA_ISO = '2026-06-09';

const createBreaker = async (clientMock: Partial<ChileCompraApiClient>) => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ChileCompraBreaker,
      { provide: ChileCompraApiClient, useValue: clientMock },
    ],
  }).compile();
  return module.get<ChileCompraBreaker>(ChileCompraBreaker);
};

describe('ChileCompraBreaker', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('retorna datos del client y estado closed en happy path', async () => {
    const licitaciones = [{ CodigoExterno: 'X-1' }];
    const breaker = await createBreaker({
      getLicitacionesByFecha: jest.fn().mockResolvedValue(licitaciones),
    });

    await expect(breaker.getLicitacionesByFecha(FECHA_ISO)).resolves.toEqual(
      licitaciones,
    );
    expect(breaker.estado).toBe('closed');
  });

  it('retorna [] sin lanzar cuando el client falla todos los reintentos', async () => {
    jest.useFakeTimers();
    const getLicitaciones = jest
      .fn()
      .mockRejectedValue(new Error('ChileCompra caída'));
    const breaker = await createBreaker({
      getLicitacionesByFecha: getLicitaciones,
    });

    const resultado = breaker.getLicitacionesByFecha(FECHA_ISO);
    await jest.advanceTimersByTimeAsync(10_000);

    await expect(resultado).resolves.toEqual([]);
    const totalIntentos = 4;
    expect(getLicitaciones).toHaveBeenCalledTimes(totalIntentos);
  });
});
