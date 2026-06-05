import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { User } from '../src/users/user.entity';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const server = () => app.getHttpServer();

  const ALICE = {
    name: 'Alice',
    email: 'alice@leo.com',
    password: 'password123',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configureApp(moduleFixture.createNestApplication());
    await app.init();

    users = app.get<Repository<User>>(getRepositoryToken(User));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await users.clear();
  });

  const register = async (): Promise<{ id: string; token: string }> => {
    const created = await request(server())
      .post('/users')
      .send(ALICE)
      .expect(201);
    const res = await request(server())
      .post('/auth/login')
      .send({ email: ALICE.email, password: ALICE.password })
      .expect(200);
    return { id: created.body.data.id, token: res.body.meta.accessToken };
  };

  describe('POST /auth/login', () => {
    it('issues a JWT for valid credentials', async () => {
      await request(server()).post('/users').send(ALICE).expect(201);
      const res = await request(server())
        .post('/auth/login')
        .send({ email: ALICE.email, password: ALICE.password })
        .expect(200);

      expect(res.body.meta.accessToken).toEqual(expect.any(String));
      expect(res.body.meta.accessToken.split('.')).toHaveLength(3);
      expect(res.body.data.type).toBe('users');
      expect(res.body.data.attributes).toMatchObject({
        email: ALICE.email,
        name: ALICE.name,
        role: 'USER',
      });
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.attributes.password).toBeUndefined();
    });

    it('rejects unknown email with 401', async () => {
      await request(server())
        .post('/auth/login')
        .send({ email: 'nobody@leo.com', password: 'password123' })
        .expect(401);
    });

    it('rejects a wrong password with 401', async () => {
      await request(server()).post('/users').send(ALICE).expect(201);
      await request(server())
        .post('/auth/login')
        .send({ email: ALICE.email, password: 'wrong-password' })
        .expect(401);
    });

    it('rejects a malformed body with 400', async () => {
      await request(server())
        .post('/auth/login')
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });

  describe('JWT-protected routes', () => {
    it('rejects a request with no token (401)', async () => {
      const { id } = await register();
      await request(server()).get(`/users/${id}`).expect(401);
    });

    it('rejects a malformed/garbage token (401)', async () => {
      const { id } = await register();
      await request(server())
        .get(`/users/${id}`)
        .set('Authorization', 'Bearer not.a.real.token')
        .expect(401);
    });

    it('accepts a valid token (200)', async () => {
      const { id, token } = await register();
      await request(server())
        .get(`/users/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('rejects a valid token whose user no longer exists (401)', async () => {
      const { id, token } = await register();
      await users.delete(id);

      await request(server())
        .get(`/users/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });
});
