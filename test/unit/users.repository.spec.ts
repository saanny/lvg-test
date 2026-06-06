import { Repository } from 'typeorm';
import { TypeOrmUsersRepository } from '../../src/users/repositories/typeorm-users.repository';
import { User } from '../../src/users/entities/user.entity';

const user = { id: 'u1', email: 'a@leo.com' } as User;

describe('TypeOrmUsersRepository', () => {
  let repo: TypeOrmUsersRepository;
  let typeorm: {
    findOne: jest.Mock;
    findAndCount: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softRemove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(() => {
    typeorm = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    repo = new TypeOrmUsersRepository(typeorm as unknown as Repository<User>);
  });

  it('findById queries by id', async () => {
    typeorm.findOne.mockResolvedValue(user);
    await expect(repo.findById('u1')).resolves.toBe(user);
    expect(typeorm.findOne).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('findByEmail includes soft-deleted rows', async () => {
    typeorm.findOne.mockResolvedValue(user);
    await repo.findByEmail('a@leo.com');
    expect(typeorm.findOne).toHaveBeenCalledWith({
      where: { email: 'a@leo.com' },
      withDeleted: true,
    });
  });

  it('findByEmailWithPassword re-selects the password via a query builder', async () => {
    const qb = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(user),
    };
    typeorm.createQueryBuilder.mockReturnValue(qb);

    await expect(repo.findByEmailWithPassword('a@leo.com')).resolves.toBe(user);
    expect(qb.addSelect).toHaveBeenCalledWith('user.password');
    expect(qb.where).toHaveBeenCalledWith('user.email = :email', {
      email: 'a@leo.com',
    });
  });

  it('findAndCount passes skip, take and where', async () => {
    typeorm.findAndCount.mockResolvedValue([[user], 1]);
    await repo.findAndCount(10, 5, { email: 'a@leo.com' });
    expect(typeorm.findAndCount).toHaveBeenCalledWith({
      where: { email: 'a@leo.com' },
      skip: 10,
      take: 5,
    });
  });

  it('create builds an unsaved entity instance', () => {
    const data = { name: 'Alice' };
    typeorm.create.mockReturnValue(data);
    expect(repo.create(data)).toBe(data);
    expect(typeorm.create).toHaveBeenCalledWith(data);
  });

  it('save persists the entity', async () => {
    typeorm.save.mockResolvedValue(user);
    await expect(repo.save(user)).resolves.toBe(user);
    expect(typeorm.save).toHaveBeenCalledWith(user);
  });

  it('remove uses softRemove', async () => {
    typeorm.softRemove.mockResolvedValue(user);
    await repo.remove(user);
    expect(typeorm.softRemove).toHaveBeenCalledWith(user);
  });
});
