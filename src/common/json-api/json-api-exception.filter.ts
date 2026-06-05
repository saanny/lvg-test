import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

interface JsonApiError {
  status: string;
  title: string;
  detail?: string;
}

@Catch()
export class JsonApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    response.setHeader('Content-Type', 'application/vnd.api+json');
    response.status(status).json({ errors: this.toErrors(status, payload) });
  }

  private toErrors(status: number, payload: unknown): JsonApiError[] {
    const statusStr = String(status);
    if (typeof payload === 'string') {
      return [{ status: statusStr, title: payload }];
    }

    const body = payload as { message?: string | string[]; error?: string };
    const title = body.error ?? 'Error';
    const messages = Array.isArray(body.message)
      ? body.message
      : [body.message ?? title];

    return messages.map((detail) => ({ status: statusStr, title, detail }));
  }
}
