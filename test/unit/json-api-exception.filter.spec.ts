import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JsonApiExceptionFilter } from '../../src/common/json-api/json-api-exception.filter';

describe('JsonApiExceptionFilter', () => {
  const filter = new JsonApiExceptionFilter();

  const makeHost = () => {
    const response = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;
    return { host, response };
  };

  it('formats an HttpException with a string message', () => {
    const { host, response } = makeHost();
    filter.catch(new HttpException('boom', HttpStatus.BAD_REQUEST), host);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      errors: [{ status: '400', title: 'boom' }],
    });
  });

  it('expands a validation error array into multiple error objects', () => {
    const { host, response } = makeHost();
    filter.catch(
      new BadRequestException(['email invalid', 'name required']),
      host,
    );
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      errors: [
        { status: '400', title: 'Bad Request', detail: 'email invalid' },
        { status: '400', title: 'Bad Request', detail: 'name required' },
      ],
    });
  });

  it('passes through pre-built JSON:API validation errors', () => {
    const { host, response } = makeHost();
    const errors = [
      {
        status: '422',
        source: { pointer: '/data/attributes/email' },
        title: 'Invalid Attribute',
        detail: 'email must be an email',
      },
    ];
    filter.catch(new UnprocessableEntityException({ errors }), host);
    expect(response.status).toHaveBeenCalledWith(422);
    expect(response.json).toHaveBeenCalledWith({ errors });
  });

  it('maps an unknown error to a 500', () => {
    const { host, response } = makeHost();
    filter.catch(new Error('kaboom'), host);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      errors: [{ status: '500', title: 'Internal server error' }],
    });
  });
});
