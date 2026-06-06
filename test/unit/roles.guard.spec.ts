import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { UserRole } from '../../src/users/user-role.enum';

const contextFor = (role: UserRole): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows any authenticated user when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextFor(UserRole.USER))).toBe(true);
  });

  it('allows any authenticated user when required roles is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(contextFor(UserRole.USER))).toBe(true);
  });

  it('allows a user whose role matches', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(guard.canActivate(contextFor(UserRole.ADMIN))).toBe(true);
  });

  it('forbids a user whose role does not match', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(contextFor(UserRole.USER))).toThrow(
      ForbiddenException,
    );
  });
});
