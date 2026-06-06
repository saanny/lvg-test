import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UsersRepository } from './users.repository';

@Injectable()
export class TypeOrmUsersRepository extends UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {
    super();
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email }, withDeleted: true });
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  findAndCount(
    skip: number,
    take: number,
    where: FindOptionsWhere<User> = {},
  ): Promise<[User[], number]> {
    return this.repo.findAndCount({
      where,
      skip,
      take,
      order: { createdAt: 'DESC', id: 'ASC' },
    });
  }

  create(data: Partial<User>): User {
    return this.repo.create(data);
  }

  save(user: User): Promise<User> {
    return this.repo.save(user);
  }

  remove(user: User): Promise<User> {
    return this.repo.softRemove(user);
  }
}
