import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExternalAPIError, ValidationError } from '../../../common/exceptions';
import {
  ChileCompraApiClient,
  toFechaChileCompra,
} from './chilecompra-api.client';

const API_URL_TEST = 'https://api.test/servicios/v1';
const TICKET_TEST = 'ticket-test';
const FECHA_ISO = '2026-06-09';
const FECHA_CHILENA = '09062026';

const createConfigStub = (ticket: string) => ({
  get: jest.fn().mockReturnValue(ticket),
  getOrThrow: jest.fn().mockReturnValue(API_URL_TEST),
});

const createClient = async (ticket: string = TICKET_TEST) => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ChileCompraApiClient,
      { provide: ConfigService, useValue: createConfigStub(ticket) },
    ],
  }).compile();
  return module.get<ChileCompraApiClient>(ChileCompraApiClient);
};

const mockFetchResponse = (body: unknown, ok = true, status = 200) =>
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('toFechaChileCompra', () => {
  it('convierte ISO YYYY-MM-DD a DDMMYYYY', () => {
    expect(toFechaChileCompra(FECHA_ISO)).toBe(FECHA_CHILENA);
  });

  it('rechaza formatos no ISO', () => {
    expect(() => toFechaChileCompra('09-06-2026')).toThrow(ValidationError);
    expect(() => toFechaChileCompra('garbage')).toThrow(ValidationError);
  });
});

describe('ChileCompraApiClient', () => {
  it('retorna el Listado y consulta con estado=todos, fecha chilena y ticket', async () => {
    const licitacion = {
      CodigoExterno: '1234-56-LE26',
      Nombre: 'Compra de insumos',
      CodigoEstado: 5,
      FechaCierre: null,
    };
    const fetchSpy = mockFetchResponse({
      Cantidad: 1,
      FechaCreacion: FECHA_ISO,
      Listado: [licitacion],
    });
    const client = await createClient();

    const resultado = await client.getLicitacionesByFecha(FECHA_ISO);

    expect(resultado).toEqual([licitacion]);
    const requestedUrl = fetchSpy.mock.calls[0][0] as URL;
    expect(requestedUrl.searchParams.get('estado')).toBe('todos');
    expect(requestedUrl.searchParams.get('fecha')).toBe(FECHA_CHILENA);
    expect(requestedUrl.searchParams.get('ticket')).toBe(TICKET_TEST);
  });

  it('retorna [] si la API responde sin Listado', async () => {
    mockFetchResponse({ Cantidad: 0, FechaCreacion: FECHA_ISO });
    const client = await createClient();

    await expect(client.getLicitacionesByFecha(FECHA_ISO)).resolves.toEqual([]);
  });

  it('lanza ExternalAPIError ante HTTP no-ok', async () => {
    mockFetchResponse({}, false, 500);
    const client = await createClient();

    await expect(client.getLicitacionesByFecha(FECHA_ISO)).rejects.toThrow(
      ExternalAPIError,
    );
  });

  it('lanza ExternalAPIError ante fallo de red', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new TypeError('fetch failed'));
    const client = await createClient();

    await expect(client.getLicitacionesByFecha(FECHA_ISO)).rejects.toThrow(
      ExternalAPIError,
    );
  });

  it('lanza ExternalAPIError si CHILECOMPRA_TICKET está vacío', async () => {
    const client = await createClient('');

    await expect(client.getLicitacionesByFecha(FECHA_ISO)).rejects.toThrow(
      'CHILECOMPRA_TICKET no configurado',
    );
  });
});
