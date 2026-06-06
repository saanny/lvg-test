import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../../config/data-source';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

const seedUsers: SeedUser[] = [
  {
    name: 'Alice Admin',
    email: 'alice.admin@leovegas.com',
    password: 'password123',
    role: UserRole.ADMIN,
  },
  {
    name: 'Bob Admin',
    email: 'bob.admin@leovegas.com',
    password: 'password123',
    role: UserRole.ADMIN,
  },
  {
    name: 'Carol User',
    email: 'carol.user@leovegas.com',
    password: 'password123',
    role: UserRole.USER,
  },
  {
    name: 'Dave User',
    email: 'dave.user@leovegas.com',
    password: 'password123',
    role: UserRole.USER,
  },
  {
    name: 'Erin User',
    email: 'erin.user@leovegas.com',
    password: 'password123',
    role: UserRole.USER,
  },
];

async function seedUsersTable(): Promise<void> {
  const users = AppDataSource.getRepository(User);

  for (const seed of seedUsers) {
    const existing = await users.findOne({ where: { email: seed.email } });
    if (existing) {
      console.log(`User "${seed.email}" already exists, skipping.`);
      continue;
    }

    const user = users.create({
      name: seed.name,
      email: seed.email,
      password: await bcrypt.hash(seed.password, 10),
      role: seed.role,
    });
    await users.save(user);
    console.log(`Seeded ${seed.role} "${seed.email}".`);
  }
}

async function run(): Promise<void> {
  await AppDataSource.initialize();
  try {
    await seedUsersTable();
  } finally {
    await AppDataSource.destroy();
  }
}

run().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
