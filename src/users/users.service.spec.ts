import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-a',
  name: 'A',
  email: 'a@leo.com',
  password: 'hashed',
  role: UserRole.USER,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

type MockRepo = jest.Mocked<UsersRepository>;
const makeRepo = (): MockRepo =>
  ({
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByEmailWithPassword: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  }) as unknown as MockRepo;

describe('UsersService', () => {
  let service: UsersService;
  let repo: MockRepo;

  const admin = makeUser({ id: 'admin-id', email: 'admin@leo.com', role: UserRole.ADMIN });
  const userA = makeUser({ id: 'user-a', email: 'a@leo.com' });

  beforeEach(async () => {
    repo = makeRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: UsersRepository, useValue: repo }],
    }).compile();

    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = { name: 'New', email: 'new@leo.com', password: 'password123' };

    it('hashes the password, forces the USER role, and saves', async () => {
      repo.findByEmail.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-pw' as never);
      repo.create.mockImplementation((x) => x as User);
      repo.save.mockImplementation(async (x) => x as User);

      await service.create(dto as any);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@leo.com',
          password: 'hashed-pw',
          role: UserRole.USER,
        }),
      );
      expect(repo.save).toHaveBeenCalled();
    });

    it('rejects a duplicate email with ConflictException', async () => {
      repo.findByEmail.mockResolvedValue(userA);
      await expect(service.create(dto as any)).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('findOneAuthorized', () => {
    it('lets an admin view any user', async () => {
      repo.findById.mockResolvedValue(userA);
      await expect(service.findOneAuthorized('user-a', admin)).resolves.toBe(userA);
    });

    it('lets a user view themselves', async () => {
      repo.findById.mockResolvedValue(userA);
      await expect(service.findOneAuthorized('user-a', userA)).resolves.toBe(userA);
    });

    it('forbids a user from viewing someone else', async () => {
      await expect(service.findOneAuthorized('other-id', userA)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the target does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOneAuthorized('admin-id', admin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated items with computed meta', async () => {
      const items = [makeUser({ id: '1' }), makeUser({ id: '2' })];
      repo.findAndCount.mockResolvedValue([items, 5]);

      const result = await service.findAll({ page: 2, limit: 2 });

      expect(repo.findAndCount).toHaveBeenCalledWith(2, 2, {});
      expect(result.items).toBe(items);
      expect(result.meta).toEqual({
        currentPage: 2,
        totalItems: 5,
        itemsPerPage: 2,
        totalPages: 3,
        nextPage: 3,
        prevPage: 1,
        itemsCount: 2,
      });
    });

    it('returns null for nextPage/prevPage on a single page', async () => {
      repo.findAndCount.mockResolvedValue([[makeUser()], 1]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.meta.nextPage).toBeNull();
      expect(result.meta.prevPage).toBeNull();
      expect(result.meta.totalPages).toBe(1);
    });

    it('filters by role when provided', async () => {
      repo.findAndCount.mockResolvedValue([[admin], 1]);

      await service.findAll({ page: 1, limit: 10, role: UserRole.ADMIN });

      expect(repo.findAndCount).toHaveBeenCalledWith(0, 10, {
        role: UserRole.ADMIN,
      });
    });
  });

  describe('update', () => {
    it('forbids updating another user when not admin', async () => {
      await expect(
        service.update('other-id', { name: 'x' }, userA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('forbids a non-admin from changing a role', async () => {
      await expect(
        service.update('user-a', { role: UserRole.ADMIN }, userA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lets an admin change a role', async () => {
      repo.findById.mockResolvedValue(makeUser());
      repo.save.mockImplementation(async (x) => x as User);

      const result = await service.update('user-a', { role: UserRole.ADMIN }, admin);

      expect(result.role).toBe(UserRole.ADMIN);
      expect(repo.save).toHaveBeenCalled();
    });

    it('rejects an email already used by another user', async () => {
      repo.findById.mockResolvedValue(makeUser());
      repo.findByEmail.mockResolvedValue(makeUser({ id: 'someone-else' }));

      await expect(
        service.update('user-a', { email: 'taken@leo.com' }, admin),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes a new password before saving', async () => {
      repo.findById.mockResolvedValue(makeUser());
      mockedBcrypt.hash.mockResolvedValue('new-hash' as never);
      repo.save.mockImplementation(async (x) => x as User);

      await service.update('user-a', { password: 'brandnew1' }, userA);

      expect(bcrypt.hash).toHaveBeenCalledWith('brandnew1', 10);
    });
  });

  describe('remove', () => {
    it('forbids a user from deleting themselves', async () => {
      await expect(service.remove('admin-id', admin)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('removes another user', async () => {
      const target = makeUser();
      repo.findById.mockResolvedValue(target);
      await service.remove('user-a', admin);
      expect(repo.remove).toHaveBeenCalledWith(target);
    });

    it('throws NotFoundException for a missing user', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.remove('ghost', admin)).rejects.toThrow(NotFoundException);
    });
  });
});
