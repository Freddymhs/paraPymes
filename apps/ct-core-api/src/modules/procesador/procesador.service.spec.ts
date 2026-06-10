import { ConfigService } from '@nestjs/config';
import { EventBus } from '@nestjs/cqrs';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { ClaimCheckService } from '@modules/ingesta/s3/claim-check.service';
import { LicitacionWriteModel } from './cqrs/licitacion-write.model';
import { LicitacionProcesadaEvent } from './cqrs/licitacion-procesada.event';
import { ProcesadorService } from './procesador.service';

const QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/licitaciones.fifo';

const PAYLOAD = {
  codigoExterno: '1234-56-LE26',
  nombre: 'Licitación de prueba',
  estado: 'publicada',
  fuente: 'api',
};

const MENSAJE_SQS = {
  MessageId: 'msg-1',
  ReceiptHandle: 'handle-1',
  Body: JSON.stringify({ type: 'licitacion', payload: PAYLOAD }),
};

describe('ProcesadorService', () => {
  const crearServicio = () => {
    const sqsSend = jest.fn();
    const sqs = { send: sqsSend } as unknown as SQSClient;
    const config = { get: jest.fn() } as unknown as ConfigService;
    const claimCheck = {
      resolver: jest.fn().mockResolvedValue(PAYLOAD),
    };
    const writeModel = {
      persistir: jest.fn().mockResolvedValue(PAYLOAD),
    };
    const eventBus = { publish: jest.fn() } as unknown as EventBus;

    const servicio = new ProcesadorService(
      sqs,
      config,
      claimCheck as unknown as ClaimCheckService,
      writeModel as unknown as LicitacionWriteModel,
      eventBus,
    );
    return { servicio, sqsSend, claimCheck, writeModel, eventBus };
  };

  it('procesa mensaje, publica evento y lo elimina de la cola', async () => {
    const { servicio, sqsSend, claimCheck, writeModel, eventBus } =
      crearServicio();
    sqsSend.mockImplementation((comando: object) => {
      if (comando instanceof ReceiveMessageCommand) {
        return Promise.resolve({ Messages: [MENSAJE_SQS] });
      }
      return Promise.resolve({});
    });

    const resumen = await servicio.procesarLote(QUEUE_URL);

    expect(resumen).toEqual({ procesados: 1, fallidos: 0 });
    expect(claimCheck.resolver).toHaveBeenCalledWith({
      type: 'licitacion',
      payload: PAYLOAD,
    });
    expect(writeModel.persistir).toHaveBeenCalledWith(PAYLOAD);
    expect(eventBus.publish).toHaveBeenCalledWith(
      new LicitacionProcesadaEvent(PAYLOAD.codigoExterno, PAYLOAD.fuente),
    );
    const eliminaciones = sqsSend.mock.calls.filter(
      ([comando]) => comando instanceof DeleteMessageCommand,
    );
    expect(eliminaciones).toHaveLength(1);
  });

  it('si persistir falla, NO elimina el mensaje (queda para redrive a DLQ)', async () => {
    const { servicio, sqsSend, writeModel, eventBus } = crearServicio();
    writeModel.persistir.mockRejectedValue(new Error('estado inválido'));
    sqsSend.mockImplementation((comando: object) => {
      if (comando instanceof ReceiveMessageCommand) {
        return Promise.resolve({ Messages: [MENSAJE_SQS] });
      }
      return Promise.resolve({});
    });

    const resumen = await servicio.procesarLote(QUEUE_URL);

    expect(resumen).toEqual({ procesados: 0, fallidos: 1 });
    expect(eventBus.publish).not.toHaveBeenCalled();
    const eliminaciones = sqsSend.mock.calls.filter(
      ([comando]) => comando instanceof DeleteMessageCommand,
    );
    expect(eliminaciones).toHaveLength(0);
  });

  it('cola vacía retorna resumen en cero', async () => {
    const { servicio, sqsSend } = crearServicio();
    sqsSend.mockResolvedValue({ Messages: [] });

    const resumen = await servicio.procesarLote(QUEUE_URL);

    expect(resumen).toEqual({ procesados: 0, fallidos: 0 });
  });
});
