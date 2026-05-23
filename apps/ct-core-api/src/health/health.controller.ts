import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectConnection } from '@nestjs/mongoose';
import { ConnectionStates, type Connection } from 'mongoose';
import type { FastifyReply } from 'fastify';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @ApiOperation({ summary: 'Health check with DB connectivity' })
  @ApiResponse({ status: 200, description: 'Service healthy' })
  @ApiResponse({ status: 503, description: 'Service degraded' })
  async check(@Res() reply: FastifyReply) {
    const dbHealthy = this.connection.readyState === ConnectionStates.connected;
    const status = dbHealthy ? 200 : 503;

    await reply.status(status).send({
      status: dbHealthy ? 'ok' : 'degraded',
      db: dbHealthy ? 'connected' : 'disconnected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }
}
