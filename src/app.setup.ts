import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JsonApiExceptionFilter } from './common/json-api/json-api-exception.filter';
import { JsonApiInterceptor } from './common/json-api/json-api.interceptor';
import { jsonApiValidationException } from './common/json-api/json-api-validation';

export function configureApp(
  app: NestExpressApplication,
): NestExpressApplication {
  const reflector = app.get(Reflector);

  app.set('query parser', 'extended');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: jsonApiValidationException,
    }),
  );
  app.useGlobalInterceptors(new JsonApiInterceptor(reflector));
  app.useGlobalFilters(new JsonApiExceptionFilter());
  return app;
}
