import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../../src/auth/jwt.strategy';
import { AuthConfigService } from '../../src/config/auth/auth-config.service';
import { UsersRepository } from '../../src/users/users.repository';
import { User } from '../../src/users/user.entity';
import { UserRole } from '../../src/users/user-role.enum';

const user = { id: 'u1', role: UserRole.USER } as User;

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersRepository: { findById: jest.Mock };

  beforeEach(() => {
    usersRepository = { findById: jest.fn() };
    strategy = new JwtStrategy(
      { jwtSecret: 'test-secret' } as AuthConfigService,
      usersRepository as unknown as UsersRepository,
    );
  });

  it('returns the user referenced by the token subject', async () => {
    usersRepository.findById.mockResolvedValue(user);
    await expect(
      strategy.validate({ sub: 'u1', role: UserRole.USER }),
    ).resolves.toBe(user);
    expect(usersRepository.findById).toHaveBeenCalledWith('u1');
  });

  it('throws UnauthorizedException when the user no longer exists', async () => {
    usersRepository.findById.mockResolvedValue(null);
    await expect(
      strategy.validate({ sub: 'gone', role: UserRole.USER }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
