import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';
import { UserRole } from '../src/users/user-role.enum';


describe('Users & Auth (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
    await app.init();

    users = app.get<Repository<User>>(getRepositoryToken(User));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await users.clear(); 
  });


  const ALICE = { name: 'Alice', email: 'alice@leo.com', password: 'password123' };

  const createAlice = () =>
    request(server()).post('/users').send(ALICE).expect(201);

  const seedAdmin = () =>
    users.save(
      users.create({
        name: 'Admin',
        email: 'admin@leo.com',
        password: bcrypt.hashSync('adminpass1', 10),
        role: UserRole.ADMIN,
      }),
    );

  const login = async (email: string, password: string): Promise<string> => {
    const res = await request(server())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken;
  };


  describe('POST /users', () => {
    it('creates a user and never leaks the password', async () => {
      const res = await createAlice();
      expect(res.body).toMatchObject({
        name: 'Alice',
        email: 'alice@leo.com',
        role: 'USER',
      });
      expect(res.body.id).toBeDefined();
      expect(res.body.password).toBeUndefined();
    });

    it('rejects a duplicate email with 409', async () => {
      await createAlice();
      await request(server()).post('/users').send(ALICE).expect(409);
    });

    it('rejects an invalid body with 400', async () => {
      await request(server())
        .post('/users')
        .send({ name: 'X', email: 'not-an-email', password: 'short' })
        .expect(400);
    });

    it('rejects unknown / non-whitelisted fields with 400', async () => {
      await request(server())
        .post('/users')
        .send({ ...ALICE, role: 'ADMIN' }) // role is not part of CreateUserDto
        .expect(400);
    });
  });


  describe('GET /users/:id', () => {
    it('requires authentication (401)', async () => {
      await request(server())
        .get('/users/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });

    it('lets a user fetch their own record', async () => {
      const created = await createAlice();
      const token = await login(ALICE.email, ALICE.password);
      const res = await request(server())
        .get(`/users/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.email).toBe(ALICE.email);
    });

    it('forbids a user from fetching someone else (403)', async () => {
      await createAlice();
      const bob = await request(server())
        .post('/users')
        .send({ name: 'Bob', email: 'bob@leo.com', password: 'password123' })
        .expect(201);
      const aliceToken = await login(ALICE.email, ALICE.password);

      await request(server())
        .get(`/users/${bob.body.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(403);
    });
  });


  describe('GET /users', () => {
    it('forbids a normal user (403)', async () => {
      await createAlice();
      const token = await login(ALICE.email, ALICE.password);
      await request(server())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('lets an admin list every user (200) with pagination meta', async () => {
      await seedAdmin();
      await createAlice();
      const token = await login('admin@leo.com', 'adminpass1');
      const res = await request(server())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.meta).toMatchObject({
        currentPage: 1,
        totalItems: 2,
        itemsPerPage: 10,
        totalPages: 1,
        nextPage: null,
        prevPage: null,
        itemsCount: 2,
      });
    });

    it('respects page and limit query params', async () => {
      await seedAdmin();
      await createAlice();
      const token = await login('admin@leo.com', 'adminpass1');
      const res = await request(server())
        .get('/users?page=1&limit=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.meta).toMatchObject({
        currentPage: 1,
        totalItems: 2,
        itemsPerPage: 1,
        totalPages: 2,
        nextPage: 2,
        prevPage: null,
      });
    });

    it('rejects an invalid limit (400)', async () => {
      await seedAdmin();
      const token = await login('admin@leo.com', 'adminpass1');
      await request(server())
        .get('/users?limit=0')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('filters by role', async () => {
      await seedAdmin();
      await createAlice();
      const token = await login('admin@leo.com', 'adminpass1');
      const res = await request(server())
        .get('/users?role=ADMIN')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].role).toBe('ADMIN');
      expect(res.body.meta.totalItems).toBe(1);
    });

    it('rejects an invalid role (400)', async () => {
      await seedAdmin();
      const token = await login('admin@leo.com', 'adminpass1');
      await request(server())
        .get('/users?role=SUPERADMIN')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });


  describe('DELETE /users/:id', () => {
    it('lets an admin delete another user (204)', async () => {
      const admin = await seedAdmin();
      const alice = await createAlice();
      const token = await login('admin@leo.com', 'adminpass1');

      await request(server())
        .delete(`/users/${alice.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(await users.findOne({ where: { id: alice.body.id } })).toBeNull();
      expect(await users.findOne({ where: { id: admin.id } })).not.toBeNull();
    });

    it('forbids an admin from deleting themselves (403)', async () => {
      const admin = await seedAdmin();
      const token = await login('admin@leo.com', 'adminpass1');

      await request(server())
        .delete(`/users/${admin.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
