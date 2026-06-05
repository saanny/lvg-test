
REST API for managing users with JWT authentication and role-based access. Anyone can register and they always start as a USER. A user can read and update their own record. An ADMIN can list, filter, and delete any user. Built with NestJS 11, MySQL 8 (TypeORM), pnpm.

## Run with Docker

```bash
cp .env.example .env
docker compose up --build
```

API runs on http://localhost:3000, Swagger on http://localhost:3000/docs. Migrations run automatically on startup.

For development with hot reload:

```bash
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up
```

## Run locally

```bash
pnpm install
pnpm migration:run
pnpm start:dev
```

## Tests

```bash
pnpm test:unit
pnpm test:integration
pnpm test:cov
pnpm test:integration:cov
```

`test:cov` writes unit coverage to `./coverage`, `test:integration:cov` writes e2e coverage to `./coverage-e2e`.

`test:integration` starts a separate MySQL on port 3307 from `docker-compose.test.yaml` (in-memory, nothing persists), runs the e2e specs against it, and removes it afterwards even if the tests fail. So Docker has to be running for integration tests, but the test process itself runs on the host.

To run the unit tests inside a container instead:

```bash
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm app pnpm test:unit
```

## Seed

```bash
pnpm seed
```

Inserts two admins and three users, all with password `password123` (emails like `alice.admin@leovegas.com`, `carol.user@leovegas.com`). It looks each up by email first and skips the ones that already exist, so running it more than once is safe. The seed list lives in `src/database/seeds/seed.ts`. Run it after migrations, against whatever database your env points at.

## API

Send the token from login as `Authorization: Bearer <accessToken>`.

| Method | Path | Access |
| --- | --- | --- |
| POST | /auth/login | public |
| POST | /users | public, always creates a USER |
| GET | /users | admin, paginated, `?page=&limit=&role=` |
| GET | /users/:id | self or admin |
| PATCH | /users/:id | self or admin, role change is admin-only |
| DELETE | /users/:id | admin, cannot delete yourself |

### Register

```
POST /users
{ "name": "Alice", "email": "alice@leo.com", "password": "password123" }

201
{ "id": "uuid", "name": "Alice", "email": "alice@leo.com", "role": "USER", "createdAt": "...", "updatedAt": "..." }
```

### Login

```
POST /auth/login
{ "email": "alice@leo.com", "password": "password123" }

200
{ "accessToken": "eyJ...", "user": { "id": "uuid", "name": "Alice", "email": "alice@leo.com", "role": "USER", "createdAt": "...", "updatedAt": "..." } }
```

### List users

```
GET /users?page=1&limit=10&role=ADMIN

200
{
  "items": [ { "id": "uuid", "name": "Bob", "email": "bob@leo.com", "role": "ADMIN", "createdAt": "...", "updatedAt": "..." } ],
  "meta": { "currentPage": 1, "totalItems": 1, "itemsPerPage": 10, "totalPages": 1, "nextPage": null, "prevPage": null, "itemsCount": 1 }
}
```

### Update

```
PATCH /users/:id
{ "name": "New name" }          // any subset of name, email, password, role (role is admin-only)
```

The password is never returned in any response.

## Migrations

```bash
pnpm migration:generate src/migrations/<Name>
pnpm migration:run
pnpm migration:revert
```

## Project structure

```
src/
  main.ts                 bootstrap, global validation pipe, serializer, Swagger
  app.module.ts           wires TypeORM and the feature modules
  config/
    database/             database env config (registerAs + typed service + module)
    auth/                 jwt env config
    database.config.ts    TypeORM options for the app
    data-source.ts        TypeORM CLI data source (migrations, seeder)
  common/dto/             pagination query and paginated response types
  users/
    users.controller.ts   routes
    users.service.ts       business rules (ownership, role checks, hashing)
    users.repository.ts    data access, the only place that touches TypeORM
    user.entity.ts
    dto/
  auth/
    auth.controller.ts     login
    auth.service.ts        credential check, token signing
    jwt.strategy.ts        validates tokens, loads the user
    guards/, decorators/
  database/seeds/seed.ts  seeder
  migrations/
test/                     e2e specs
```

## Environment

`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN`. The app fails to start if a required one is missing.
