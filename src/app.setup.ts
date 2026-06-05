import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JsonApiExceptionFilter } from './common/json-api/json-api-exception.filter';
import { JsonApiInterceptor } from './common/json-api/json-api.interceptor';

export function configureApp(app: INestApplication): INestApplication {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new JsonApiInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new JsonApiExceptionFilter());
  return app;
}
