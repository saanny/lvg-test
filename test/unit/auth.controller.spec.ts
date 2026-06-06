import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: { login: jest.Mock };

  beforeEach(() => {
    service = { login: jest.fn() };
    controller = new AuthController(service as unknown as AuthService);
  });

  it('login delegates email and password to the service', async () => {
    const result = { accessToken: 'jwt', user: { id: 'u1' } };
    service.login.mockResolvedValue(result);

    await expect(
      controller.login({ email: 'a@leo.com', password: 'password123' }),
    ).resolves.toBe(result);
    expect(service.login).toHaveBeenCalledWith('a@leo.com', 'password123');
  });
});
