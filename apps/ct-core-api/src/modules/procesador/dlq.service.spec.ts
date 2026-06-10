import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { ENV_KEYS } from '@config/env.constants';
import { MensajeFallidoDocument } from './mensajes-fallidos/mensaje-fallido.schema';
import { DlqService } from './dlq.service';

const DLQ_URL = 'https://sqs.us-east-1.amazonaws.com/123/licitaciones-dlq.fifo';
const FROM_EMAIL = 'alertas@parapymes.cl';

const MENSAJE_DLQ = {
  MessageId: 'dlq-1',
  ReceiptHandle: 'handle-dlq-1',
  Body: '{"type":"licitacion","payload":{}}',
};

describe('DlqService', () => {
  const crearServicio = () => {
    const sqsSend = jest.fn().mockResolvedValue({ Messages: [MENSAJE_DLQ] });
    const sesSend = jest.fn().mockResolvedValue({});
    const config = {
      get: jest.fn((clave: string, porDefecto?: string) => {
        if (clave === ENV_KEYS.SQS_DLQ_URL) return DLQ_URL;
        if (clave === ENV_KEYS.SES_FROM_EMAIL) return FROM_EMAIL;
        return porDefecto;
      }),
    } as unknown as ConfigService;
    const mensajesFallidos = { create: jest.fn().mockResolvedValue({}) };

    const servicio = new DlqService(
      { send: sqsSend } as unknown as SQSClient,
      { send: sesSend } as unknown as SESClient,
      config,
      mensajesFallidos as unknown as Model<MensajeFallidoDocument>,
    );
    return { servicio, sqsSend, sesSend, mensajesFallidos };
  };

  it('archiva mensajes de DLQ en MongoDB y los elimina de la cola', async () => {
    const { servicio, sqsSend, mensajesFallidos } = crearServicio();

    const cantidad = await servicio.revisarDlq();

    expect(cantidad).toBe(1);
    expect(mensajesFallidos.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sqsMessageId: MENSAJE_DLQ.MessageId,
        body: MENSAJE_DLQ.Body,
      }),
    );
    // receive + delete
    expect(sqsSend).toHaveBeenCalledTimes(2);
  });

  it('rate-limita alertas SES: máximo una por ventana de 30 minutos', async () => {
    const { servicio, sesSend } = crearServicio();

    await servicio.revisarDlq();
    await servicio.revisarDlq();

    const alertas = sesSend.mock.calls.filter(
      ([comando]) => comando instanceof SendEmailCommand,
    );
    expect(alertas).toHaveLength(1);
  });

  it('sin SQS_DLQ_URL configurada no hace nada', async () => {
    const { servicio, sqsSend } = crearServicio();
    const config = (servicio as unknown as { config: { get: jest.Mock } })
      .config;
    config.get.mockReturnValue('');

    const cantidad = await servicio.revisarDlq();

    expect(cantidad).toBe(0);
    expect(sqsSend).not.toHaveBeenCalled();
  });
});
