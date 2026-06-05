import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
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

  const ALICE = {
    name: 'Alice',
    email: 'alice@leo.com',
    password: 'password123',
  };

  const createUser = (payload: Record<string, unknown>) =>
    request(server()).post('/users').send(payload);

  const createAlice = () => createUser(ALICE).expect(201);

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
    return res.body.meta.accessToken;
  };

  describe('POST /users', () => {
    it('creates a user as a JSON:API resource and never leaks the password', async () => {
      const res = await createAlice();
      expect(res.body.data.type).toBe('users');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.attributes).toMatchObject({
        name: 'Alice',
        email: 'alice@leo.com',
        role: 'USER',
      });
      expect(res.body.data.attributes.password).toBeUndefined();
    });

    it('rejects a duplicate email with 409', async () => {
      await createAlice();
      await createUser(ALICE).expect(409);
    });

    it('rejects an invalid body with a JSON:API error (400)', async () => {
      const res = await createUser({
        name: 'X',
        email: 'not-an-email',
        password: 'short',
      }).expect(400);
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors[0].status).toBe('400');
    });

    it('rejects unknown / non-whitelisted fields with 400', async () => {
      await createUser({ ...ALICE, role: 'ADMIN' }).expect(400);
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
        .get(`/users/${created.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.data.attributes.email).toBe(ALICE.email);
    });

    it('forbids a user from fetching someone else (403)', async () => {
      await createAlice();
      const bob = await createUser({
        name: 'Bob',
        email: 'bob@leo.com',
        password: 'password123',
      }).expect(201);
      const aliceToken = await login(ALICE.email, ALICE.password);

      await request(server())
        .get(`/users/${bob.body.data.id}`)
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

    it('lets an admin list every user as a JSON:API collection (200)', async () => {
      await seedAdmin();
      await createAlice();
      const token = await login('admin@leo.com', 'adminpass1');
      const res = await request(server())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].type).toBe('users');
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

      expect(res.body.data).toHaveLength(1);
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

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].attributes.role).toBe('ADMIN');
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

  describe('PATCH /users/:id', () => {
    it('lets a user update their own name', async () => {
      const created = await createAlice();
      const token = await login(ALICE.email, ALICE.password);
      const res = await request(server())
        .patch(`/users/${created.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Alice Updated' })
        .expect(200);
      expect(res.body.data.attributes.name).toBe('Alice Updated');
    });

    it('forbids a user from updating someone else (403)', async () => {
      await createAlice();
      const bob = await createUser({
        name: 'Bob',
        email: 'bob@leo.com',
        password: 'password123',
      }).expect(201);
      const token = await login(ALICE.email, ALICE.password);
      await request(server())
        .patch(`/users/${bob.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked' })
        .expect(403);
    });

    it('forbids a non-admin from changing their role (403)', async () => {
      const created = await createAlice();
      const token = await login(ALICE.email, ALICE.password);
      await request(server())
        .patch(`/users/${created.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'ADMIN' })
        .expect(403);
    });

    it('lets an admin change a user role (200)', async () => {
      await seedAdmin();
      const alice = await createAlice();
      const token = await login('admin@leo.com', 'adminpass1');
      const res = await request(server())
        .patch(`/users/${alice.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'ADMIN' })
        .expect(200);
      expect(res.body.data.attributes.role).toBe('ADMIN');
    });

    it('returns 409 when an admin updates a user email to one already taken', async () => {
      await seedAdmin();
      const alice = await createAlice();
      await createUser({
        name: 'Carol',
        email: 'carol@leo.com',
        password: 'password123',
      }).expect(201);
      const token = await login('admin@leo.com', 'adminpass1');
      await request(server())
        .patch(`/users/${alice.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'carol@leo.com' })
        .expect(409);
    });

    it('returns 404 for a missing user', async () => {
      await seedAdmin();
      const token = await login('admin@leo.com', 'adminpass1');
      await request(server())
        .patch('/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Ghost' })
        .expect(404);
    });
  });

  describe('DELETE /users/:id (soft delete)', () => {
    it('lets an admin delete another user (204)', async () => {
      const admin = await seedAdmin();
      const alice = await createAlice();
      const token = await login('admin@leo.com', 'adminpass1');

      await request(server())
        .delete(`/users/${alice.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(
        await users.findOne({ where: { id: alice.body.data.id } }),
      ).toBeNull();
      expect(await users.findOne({ where: { id: admin.id } })).not.toBeNull();
    });

    it('soft-deletes: row remains, login blocked, email reserved', async () => {
      await seedAdmin();
      const alice = await createAlice();
      const token = await login('admin@leo.com', 'adminpass1');

      await request(server())
        .delete(`/users/${alice.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const row = await users.findOne({
        where: { id: alice.body.data.id },
        withDeleted: true,
      });
      expect(row?.deletedAt).toBeTruthy();

      await request(server())
        .post('/auth/login')
        .send({ email: ALICE.email, password: ALICE.password })
        .expect(401);

      await createUser(ALICE).expect(409);
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
