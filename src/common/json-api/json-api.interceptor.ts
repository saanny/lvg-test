import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { instanceToPlain } from 'class-transformer';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { JSON_API_RESOURCE } from './json-api-resource.decorator';

interface Resource {
  type: string;
  id: unknown;
  attributes: Record<string, unknown>;
}

@Injectable()
export class JsonApiInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const type = this.reflector.getAllAndOverride<string>(JSON_API_RESOURCE, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next
      .handle()
      .pipe(map((data) => this.toDocument(type, data, context)));
  }

  private toDocument(
    type: string | undefined,
    data: unknown,
    context: ExecutionContext,
  ): unknown {
    if (!type || data === null || data === undefined) {
      return data;
    }

    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Content-Type', 'application/vnd.api+json');

    const body = data as Record<string, unknown>;

    if (typeof body.accessToken === 'string' && body.user) {
      return {
        data: this.toResource(type, body.user),
        meta: { accessToken: body.accessToken },
      };
    }

    if (Array.isArray(body.items) && body.meta) {
      return {
        data: body.items.map((item) => this.toResource(type, item)),
        meta: body.meta,
      };
    }

    return { data: this.toResource(type, data) };
  }

  private toResource(type: string, entity: unknown): Resource {
    const { id, ...attributes } = instanceToPlain(entity) as Record<
      string,
      unknown
    >;
    return { type, id, attributes };
  }
}
