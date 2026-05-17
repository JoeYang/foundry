import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError } from '../errors.js';

async function errorHandlerPluginImpl(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    const requestId = req.requestId;

    if (err instanceof ZodError) {
      const message = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return reply.status(400).send({
        error: 'VALIDATION_FAILED',
        message,
        request_id: requestId,
      });
    }

    if (hasZodFastifySchemaValidationErrors(err)) {
      const message = err.validation
        .map((v) => `${v.instancePath}: ${v.message}`)
        .join('; ');
      return reply.status(400).send({
        error: 'VALIDATION_FAILED',
        message,
        request_id: requestId,
      });
    }

    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({
        error: err.code,
        message: err.message,
        request_id: requestId,
      });
    }

    const pgErr = err as { code?: string; constraint?: string };
    if (pgErr.code === '23505') {
      return reply.status(409).send({
        error: 'CONFLICT',
        message: 'duplicate key',
        request_id: requestId,
      });
    }
    if (pgErr.code === '23514') {
      return reply.status(400).send({
        error: 'VALIDATION_FAILED',
        message: `check constraint failed: ${pgErr.constraint ?? 'unknown'}`,
        request_id: requestId,
      });
    }

    req.log.error({ err, requestId }, 'unhandled error');
    return reply.status(500).send({
      error: 'INTERNAL',
      message: 'internal server error',
      request_id: requestId,
    });
  });
}

export const errorHandlerPlugin = fp(errorHandlerPluginImpl, { name: 'error-handler' });
