import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { instanceToPlain } from 'class-transformer';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginationMeta } from '../dto/paginated.dto';
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
      const request = context.switchToHttp().getRequest<Request>();
      const meta = body.meta as PaginationMeta;
      return {
        data: body.items.map((item) => this.toResource(type, item)),
        meta,
        links: this.buildLinks(request, meta),
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

  private buildLinks(
    request: Request,
    meta: PaginationMeta,
  ): Record<string, string | null> {
    const role =
      typeof request.query.role === 'string' ? request.query.role : undefined;
    const url = (n: number): string => {
      const base = `${request.path}?page[number]=${n}&page[size]=${meta.itemsPerPage}`;
      return role ? `${base}&role=${role}` : base;
    };
    return {
      self: url(meta.currentPage),
      first: url(1),
      last: url(meta.totalPages || 1),
      prev: meta.prevPage ? url(meta.prevPage) : null,
      next: meta.nextPage ? url(meta.nextPage) : null,
    };
  }
}
