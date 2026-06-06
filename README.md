
REST API for managing users with JWT authentication and role-based access. Anyone can register and they always start as a USER. A user can read and update their own record. An ADMIN can list, filter, and delete any user. Built with NestJS 11, MySQL 8 (TypeORM), pnpm.

## Run with Docker

```bash
cp .env.example .env
pnpm docker:up
```

API runs on http://localhost:3000, Swagger on http://localhost:3000/docs. Migrations run automatically on startup.

| Script | What it does |
| --- | --- |
| `pnpm docker:up` | build + start the prod stack (detached) |
| `pnpm docker:dev` | start with hot reload (mounts `./src`, `nest start --watch`) |
| `pnpm docker:logs` | follow the app logs |
| `pnpm docker:down` | stop the stack |
| `pnpm docker:down:volumes` | stop and wipe the database volume |

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

Follows the JSON:API specification. Request bodies for create/update are wrapped in `{ "data": { "type": "users", "id"?, "attributes": {...} } }`; responses are `{ "data": { "type", "id", "attributes" } }` (or `{ "data": [...], "meta", "links" }` for a collection); errors are `{ "errors": [...] }`. Send the token from login as `Authorization: Bearer <accessToken>`.

| Method | Path | Access |
| --- | --- | --- |
| POST | /auth/login | public |
| POST | /users | public, always creates a USER |
| GET | /users | admin, paginated, `?page[number]=&page[size]=&role=` |
| GET | /users/:id | self or admin |
| PATCH | /users/:id | self or admin, role change is admin-only |
| DELETE | /users/:id | admin, cannot delete yourself, soft delete |

### Register

```
POST /users
{ "data": { "type": "users", "attributes": { "name": "Alice", "email": "alice@leo.com", "password": "password123" } } }

201
{ "data": { "type": "users", "id": "uuid", "attributes": { "name": "Alice", "email": "alice@leo.com", "role": "USER", "createdAt": "...", "updatedAt": "..." } } }
```

### Login

Login is the one non-resource action: the request is flat, the user is returned as the primary resource, the token is in `meta`.

```
POST /auth/login
{ "email": "alice@leo.com", "password": "password123" }

200
{ "data": { "type": "users", "id": "uuid", "attributes": { "name": "Alice", "email": "alice@leo.com", "role": "USER" } }, "meta": { "accessToken": "eyJ..." } }
```

### List users

```
GET /users?page[number]=1&page[size]=10&role=ADMIN

200
{
  "data": [ { "type": "users", "id": "uuid", "attributes": { "name": "Bob", "email": "bob@leo.com", "role": "ADMIN", "createdAt": "...", "updatedAt": "..." } } ],
  "meta": { "currentPage": 1, "totalItems": 1, "itemsPerPage": 10, "totalPages": 1, "nextPage": null, "prevPage": null, "itemsCount": 1 },
  "links": { "self": "/users?page[number]=1&page[size]=10", "first": "...", "last": "...", "prev": null, "next": null }
}
```

### Update

```
PATCH /users/:id
{ "data": { "type": "users", "id": "<same as URL>", "attributes": { "name": "New name" } } }
```

`attributes` is any non-empty subset of name, email, password, role (role is admin-only). The body `type` must be `users` and `id` must match the URL, else `409`. Returns the updated resource.

### Errors

Invalid attributes return `422` with a `source.pointer`; other failures use the matching status:

```
422  { "errors": [ { "status": "422", "source": { "pointer": "/data/attributes/email" }, "title": "Invalid Attribute", "detail": "email must be an email" } ] }
404  { "errors": [ { "status": "404", "title": "Not Found", "detail": "User <id> not found" } ] }
```

The password is never returned in any response. Delete is a soft delete: the row is kept with a `deletedAt` timestamp, the user can no longer log in, and the email stays reserved.

## Migrations

```bash
pnpm migration:generate src/migrations/<Name>
pnpm migration:run
pnpm migration:revert
```

## Project structure

```
src/
  main.ts                 bootstrap and Swagger
  app.setup.ts            shared app config (validation pipe, JSON:API interceptor + filter)
  app.module.ts           ConfigModule.forRoot, TypeORM, feature modules
  config/
    env.validation.ts     Joi schema for env vars
    database/             database env config (registerAs + typed service)
    auth/                 jwt env config
    database.config.ts    TypeORM options for the app
    data-source.ts        TypeORM CLI data source (migrations, seeder)
  common/
    dto/                  pagination query and paginated response types
    json-api/             interceptor, exception filter, @JsonApiResource decorator
  users/
    users.controller.ts   routes
    users.service.ts       business rules (ownership, role checks, hashing)
    entities/              user.entity.ts (soft-delete deletedAt column)
    enums/                 user-role.enum.ts
    repositories/          users.repository.ts (abstract contract) + typeorm-users.repository.ts (impl)
    dto/
  auth/
    auth.controller.ts     login
    auth.service.ts        credential check, token signing
    strategies/            jwt.strategy.ts (validates tokens, loads the user)
    guards/, decorators/, dto/
  database/seeds/seed.ts  seeder
  migrations/
test/
  unit/                   unit specs (services, guard, strategy, repository, json-api)
  integration/            e2e specs (full HTTP + database)
  jest-integration.json   jest config for the integration run
```

## Environment

`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN`. The app fails to start if a required one is missing.
