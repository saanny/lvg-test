import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { User } from '../../src/users/entities/user.entity';
import { UserRole } from '../../src/users/enums/user-role.enum';

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('Users & Auth (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configureApp(
      moduleFixture.createNestApplication<NestExpressApplication>(),
    );
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

  const createBody = (attributes: Record<string, unknown>) => ({
    data: { type: 'users', attributes },
  });
  const updateBody = (id: string, attributes: Record<string, unknown>) => ({
    data: { type: 'users', id, attributes },
  });

  const createUser = (attributes: Record<string, unknown>) =>
    request(server()).post('/users').send(createBody(attributes));

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

    it('rejects a body without a data member (422)', async () => {
      await request(server()).post('/users').send(ALICE).expect(422);
    });

    it('rejects a wrong resource type (409)', async () => {
      await request(server())
        .post('/users')
        .send({ data: { type: 'people', attributes: ALICE } })
        .expect(409);
    });

    it('rejects a duplicate email with 409', async () => {
      await createAlice();
      await createUser(ALICE).expect(409);
    });

    it('rejects invalid attributes with a 422 JSON:API error', async () => {
      const res = await createUser({
        name: 'X',
        email: 'not-an-email',
        password: 'short',
      }).expect(422);
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors[0].status).toBe('422');
      expect(
        res.body.errors.map(
          (e: { source: { pointer: string } }) => e.source.pointer,
        ),
      ).toContain('/data/attributes/email');
    });

    it('rejects unknown attributes with 422', async () => {
      await createUser({ ...ALICE, role: 'ADMIN' }).expect(422);
    });
  });

  describe('GET /users/:id', () => {
    it('requires authentication (401)', async () => {
      await request(server()).get(`/users/${MISSING_ID}`).expect(401);
    });

    it('lets a USER view their own details', async () => {
      const created = await createAlice();
      const token = await login(ALICE.email, ALICE.password);
      const res = await request(server())
        .get(`/users/${created.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.data.attributes.email).toBe(ALICE.email);
    });

    it('forbids a USER from viewing someone else (403)', async () => {
      await createAlice();
      const bob = await createUser({
        name: 'Bob',
        email: 'bob@leo.com',
        password: 'password123',
      }).expect(201);
      const token = await login(ALICE.email, ALICE.password);
      await request(server())
        .get(`/users/${bob.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('returns 404 when an ADMIN views a non-existent user', async () => {
      await seedAdmin();
      const token = await login('admin@leo.com', 'adminpass1');
      await request(server())
        .get(`/users/${MISSING_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('GET /users (ADMIN only)', () => {
    it('forbids a normal USER (403)', async () => {
      await createAlice();
      const token = await login(ALICE.email, ALICE.password);
      await request(server())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('lets an ADMIN list users as a JSON:API collection with meta and links', async () => {
      await seedAdmin();
      await createAlice();
      const token = await login('admin@leo.com', 'adminpass1');
      const res = await request(server())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].type).toBe('users');
      expect(res.body.meta).toMatchObject({ currentPage: 1, totalItems: 2 });
      expect(res.body.links.self).toBe('/users?page[number]=1&page[size]=10');
    });

    it('respects page[number] and page[size]', async () => {
      await seedAdmin();
      await createAlice();
      const token = await login('admin@leo.com', 'adminpass1');
      const res = await request(server())
        .get('/users?page[number]=1&page[size]=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toMatchObject({
        currentPage: 1,
        totalItems: 2,
        itemsPerPage: 1,
        totalPages: 2,
        nextPage: 2,
      });
      expect(res.body.links.next).toBe('/users?page[number]=2&page[size]=1');
    });

    it('rejects an invalid page size (422)', async () => {
      await seedAdmin();
      const token = await login('admin@leo.com', 'adminpass1');
      await request(server())
        .get('/users?page[size]=0')
        .set('Authorization', `Bearer ${token}`)
        .expect(422);
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
    });

    it('rejects an invalid role (422)', async () => {
      await seedAdmin();
      const token = await login('admin@leo.com', 'adminpass1');
      await request(server())
        .get('/users?role=SUPERADMIN')
        .set('Authorization', `Bearer ${token}`)
        .expect(422);
    });
  });

  describe('PATCH /users/:id', () => {
    it('lets a USER update their own details', async () => {
      const created = await createAlice();
      const token = await login(ALICE.email, ALICE.password);
      const res = await request(server())
        .patch(`/users/${created.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateBody(created.body.data.id, { name: 'Alice Updated' }))
        .expect(200);
      expect(res.body.data.attributes.name).toBe('Alice Updated');
    });

    it('rejects an empty attributes object (422)', async () => {
      const created = await createAlice();
      const token = await login(ALICE.email, ALICE.password);
      await request(server())
        .patch(`/users/${created.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateBody(created.body.data.id, {}))
        .expect(422);
    });

    it('rejects a body id that does not match the URL (409)', async () => {
      const created = await createAlice();
      const token = await login(ALICE.email, ALICE.password);
      await request(server())
        .patch(`/users/${created.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateBody(MISSING_ID, { name: 'X' }))
        .expect(409);
    });

    it('forbids a USER from updating someone else (403)', async () => {
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
        .send(updateBody(bob.body.data.id, { name: 'Hacked' }))
        .expect(403);
    });

    it('forbids a non-admin from changing their role (403)', async () => {
      const created = await createAlice();
      const token = await login(ALICE.email, ALICE.password);
      await request(server())
        .patch(`/users/${created.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateBody(created.body.data.id, { role: 'ADMIN' }))
        .expect(403);
    });

    it('lets an ADMIN update the role and details of another user (200)', async () => {
      await seedAdmin();
      const alice = await createAlice();
      const token = await login('admin@leo.com', 'adminpass1');
      const res = await request(server())
        .patch(`/users/${alice.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(
          updateBody(alice.body.data.id, { role: 'ADMIN', name: 'Promoted' }),
        )
        .expect(200);
      expect(res.body.data.attributes.role).toBe('ADMIN');
      expect(res.body.data.attributes.name).toBe('Promoted');
    });

    it('returns 409 when an ADMIN updates an email already taken', async () => {
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
        .send(updateBody(alice.body.data.id, { email: 'carol@leo.com' }))
        .expect(409);
    });

    it('returns 404 when an ADMIN updates a non-existent user', async () => {
      await seedAdmin();
      const token = await login('admin@leo.com', 'adminpass1');
      await request(server())
        .patch(`/users/${MISSING_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateBody(MISSING_ID, { name: 'Ghost' }))
        .expect(404);
    });
  });

  describe('DELETE /users/:id (ADMIN only, soft delete)', () => {
    it('forbids a USER from deleting (403)', async () => {
      const created = await createAlice();
      const token = await login(ALICE.email, ALICE.password);
      await request(server())
        .delete(`/users/${created.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('lets an ADMIN delete another user (204)', async () => {
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

    it('forbids an ADMIN from deleting themselves (403)', async () => {
      const admin = await seedAdmin();
      const token = await login('admin@leo.com', 'adminpass1');
      await request(server())
        .delete(`/users/${admin.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('returns 404 when an ADMIN deletes a non-existent user', async () => {
      await seedAdmin();
      const token = await login('admin@leo.com', 'adminpass1');
      await request(server())
        .delete(`/users/${MISSING_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
