import { ConflictException } from '@nestjs/common';
import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';
import { CreateUserRequest } from '../../src/users/dto/create-user-request.dto';
import { UpdateUserRequest } from '../../src/users/dto/update-user-request.dto';
import { User } from '../../src/users/user.entity';
import { UserRole } from '../../src/users/user-role.enum';

const actor = { id: 'actor-id', role: UserRole.ADMIN } as User;

describe('UsersController', () => {
  let controller: UsersController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOneAuthorized: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOneAuthorized: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new UsersController(service as unknown as UsersService);
  });

  it('create unwraps attributes and delegates to the service', async () => {
    const attributes = {
      name: 'A',
      email: 'a@leo.com',
      password: 'password123',
    };
    service.create.mockResolvedValue('created');
    const body = { data: { type: 'users', attributes } };
    await expect(controller.create(body)).resolves.toBe('created');
    expect(service.create).toHaveBeenCalledWith(attributes);
  });

  it('create rejects a wrong resource type', () => {
    const body = {
      data: { type: 'people', attributes: { name: 'A' } },
    } as CreateUserRequest;
    expect(() => controller.create(body)).toThrow(ConflictException);
  });

  it('findAll delegates with the query', async () => {
    const query = { page: { number: 2, size: 5 } };
    service.findAll.mockResolvedValue('list');
    await expect(controller.findAll(query)).resolves.toBe('list');
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne delegates with the id and actor', async () => {
    service.findOneAuthorized.mockResolvedValue('user');
    await expect(controller.findOne('id-1', actor)).resolves.toBe('user');
    expect(service.findOneAuthorized).toHaveBeenCalledWith('id-1', actor);
  });

  it('update unwraps attributes and delegates with the id and actor', async () => {
    const attributes = { name: 'New' };
    service.update.mockResolvedValue('updated');
    const body = {
      data: { type: 'users', id: 'id-1', attributes },
    } as UpdateUserRequest;
    await expect(controller.update('id-1', body, actor)).resolves.toBe(
      'updated',
    );
    expect(service.update).toHaveBeenCalledWith('id-1', attributes, actor);
  });

  it('update rejects a body id that does not match the URL', () => {
    const body = {
      data: { type: 'users', id: 'other', attributes: { name: 'New' } },
    } as UpdateUserRequest;
    expect(() => controller.update('id-1', body, actor)).toThrow(
      ConflictException,
    );
  });

  it('remove delegates with the id and actor', async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove('id-1', actor);
    expect(service.remove).toHaveBeenCalledWith('id-1', actor);
  });
});
