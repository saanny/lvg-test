import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersRepository } from '../users/users.repository';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const user: User = {
  id: 'u1',
  name: 'U',
  email: 'u@leo.com',
  password: 'hashed',
  role: UserRole.USER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: { findByEmailWithPassword: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    usersRepository = { findByEmailWithPassword: jest.fn() };
    jwtService = { signAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersRepository, useValue: usersRepository },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  describe('validateCredentials', () => {
    it('returns the user when the password matches', async () => {
      usersRepository.findByEmailWithPassword.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await expect(
        service.validateCredentials('u@leo.com', 'pw'),
      ).resolves.toBe(user);
    });

    it('throws UnauthorizedException when the user is not found', async () => {
      usersRepository.findByEmailWithPassword.mockResolvedValue(null);

      await expect(
        service.validateCredentials('missing@leo.com', 'pw'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on a wrong password', async () => {
      usersRepository.findByEmailWithPassword.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.validateCredentials('u@leo.com', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('signs a JWT carrying the user id (sub) and role', async () => {
      usersRepository.findByEmailWithPassword.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtService.signAsync.mockResolvedValue('signed.jwt.token');

      const result = await service.login('u@leo.com', 'pw');

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        role: UserRole.USER,
      });
      expect(result).toEqual({ accessToken: 'signed.jwt.token', user });
    });
  });
});
