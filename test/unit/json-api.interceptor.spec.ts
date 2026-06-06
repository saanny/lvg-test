import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { JsonApiInterceptor } from '../../src/common/json-api/json-api.interceptor';

describe('JsonApiInterceptor', () => {
  let interceptor: JsonApiInterceptor;
  let reflector: { getAllAndOverride: jest.Mock };
  const setHeader = jest.fn();

  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getResponse: () => ({ setHeader }),
      getRequest: () => ({ path: '/users', query: {} }),
    }),
  } as unknown as ExecutionContext;

  const run = (type: string | undefined, data: unknown): Promise<unknown> => {
    reflector.getAllAndOverride.mockReturnValue(type);
    const handler: CallHandler = { handle: () => of(data) };
    return lastValueFrom(interceptor.intercept(context, handler));
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    interceptor = new JsonApiInterceptor(reflector as unknown as Reflector);
  });

  it('wraps a single resource', async () => {
    const result = await run('users', { id: '1', name: 'Alice' });
    expect(result).toEqual({
      data: { type: 'users', id: '1', attributes: { name: 'Alice' } },
    });
  });

  it('wraps a paginated collection with meta and links', async () => {
    const meta = {
      currentPage: 1,
      totalItems: 1,
      itemsPerPage: 10,
      totalPages: 1,
      nextPage: null,
      prevPage: null,
      itemsCount: 1,
    };
    const result = (await run('users', {
      items: [{ id: '1', name: 'Alice' }],
      meta,
    })) as { data: unknown[]; meta: unknown; links: Record<string, unknown> };

    expect(result.data).toEqual([
      { type: 'users', id: '1', attributes: { name: 'Alice' } },
    ]);
    expect(result.meta).toEqual(meta);
    expect(result.links.self).toBe('/users?page[number]=1&page[size]=10');
    expect(result.links.next).toBeNull();
  });

  it('puts the access token in meta for a login response', async () => {
    const result = await run('users', {
      accessToken: 'jwt',
      user: { id: '1', name: 'Alice' },
    });
    expect(result).toEqual({
      data: { type: 'users', id: '1', attributes: { name: 'Alice' } },
      meta: { accessToken: 'jwt' },
    });
  });

  it('passes through a null body (no content)', async () => {
    expect(await run('users', null)).toBeNull();
  });

  it('passes through untagged responses unchanged', async () => {
    const data = { id: '1', name: 'Alice' };
    expect(await run(undefined, data)).toBe(data);
  });
});
