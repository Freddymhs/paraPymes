import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { HealthController } from './health.controller';

const createMockConnection = (readyState: number) => ({ readyState });

const createMockReply = () => {
  const reply = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockResolvedValue(undefined),
  };
  return reply as unknown as Parameters<HealthController['check']>[0];
};

describe('HealthController', () => {
  let controller: HealthController;
  let mockConnection: { readyState: number };

  beforeEach(async () => {
    mockConnection = createMockConnection(1);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: getConnectionToken(), useValue: mockConnection }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return 200 ok when MongoDB is connected (readyState=1)', async () => {
    mockConnection.readyState = 1;
    const reply = createMockReply();

    await controller.check(reply);

    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ok', db: 'connected' }),
    );
  });

  it('should return 503 degraded when MongoDB is disconnected (readyState=0)', async () => {
    mockConnection.readyState = 0;
    const reply = createMockReply();

    await controller.check(reply);

    expect(reply.status).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'degraded', db: 'disconnected' }),
    );
  });
});
