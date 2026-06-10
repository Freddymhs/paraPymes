import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import { SqsPublisherService } from './sqs-publisher.service';
import { ClaimCheckService, MENSAJE_TIPOS } from '../s3/claim-check.service';
import { SQS_CLIENT } from '../aws/aws.providers';

const QUEUE_URL_TEST = 'https://sqs.test/cola.fifo';
const FECHA_ISO = '2026-06-09';
const TOTAL_ENTRADAS = 25;

const claimCheckStub = {
  envolver: jest.fn((_fecha: string, _codigo: string, payload: object) =>
    Promise.resolve({ type: MENSAJE_TIPOS.LICITACION, payload }),
  ),
};

type SqsSendMock = jest.Mock<Promise<object>, [SendMessageBatchCommand]>;

const crearSqsSend = (respuesta: object): SqsSendMock =>
  jest
    .fn<Promise<object>, [SendMessageBatchCommand]>()
    .mockResolvedValue(respuesta);

const createService = async (sqsSendMock: SqsSendMock) => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SqsPublisherService,
      { provide: SQS_CLIENT, useValue: { send: sqsSendMock } },
      { provide: ClaimCheckService, useValue: claimCheckStub },
      {
        provide: ConfigService,
        useValue: { getOrThrow: jest.fn().mockReturnValue(QUEUE_URL_TEST) },
      },
    ],
  }).compile();
  return module.get<SqsPublisherService>(SqsPublisherService);
};

const crearEntradas = (total: number) =>
  Array.from({ length: total }, (_, i) => ({
    codigoExterno: `COD-${i}`,
    payload: { codigoExterno: `COD-${i}` },
  }));

describe('SqsPublisherService', () => {
  afterEach(() => jest.clearAllMocks());

  it('parte en lotes de máximo 10 y publica todos', async () => {
    const sqsSend = crearSqsSend({ Failed: [] });
    const service = await createService(sqsSend);

    const resumen = await service.publicarLicitaciones(
      FECHA_ISO,
      crearEntradas(TOTAL_ENTRADAS),
    );

    expect(resumen).toEqual({ publicadas: TOTAL_ENTRADAS, fallidas: 0 });
    const lotesEsperados = 3;
    expect(sqsSend).toHaveBeenCalledTimes(lotesEsperados);
    const [[primerComando]] = sqsSend.mock.calls;
    expect(primerComando.input.Entries).toHaveLength(10);
  });

  it('usa MessageGroupId fijo y dedup por codigoExterno', async () => {
    const sqsSend = crearSqsSend({ Failed: [] });
    const service = await createService(sqsSend);

    await service.publicarLicitaciones(FECHA_ISO, crearEntradas(1));

    const [[comando]] = sqsSend.mock.calls;
    const entry = comando.input.Entries?.[0];
    expect(entry?.MessageGroupId).toBe('licitaciones');
    expect(entry?.MessageDeduplicationId).toBe('COD-0');
  });

  it('cuenta fallidas reportadas por SQS', async () => {
    const sqsSend = crearSqsSend({ Failed: [{ Id: '0' }, { Id: '1' }] });
    const service = await createService(sqsSend);

    const resumen = await service.publicarLicitaciones(
      FECHA_ISO,
      crearEntradas(5),
    );

    expect(resumen).toEqual({ publicadas: 3, fallidas: 2 });
  });
});
