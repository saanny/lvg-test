import { FindOptionsWhere } from 'typeorm';
import { User } from '../entities/user.entity';

export abstract class UsersRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findByEmailWithPassword(email: string): Promise<User | null>;
  abstract findAndCount(
    skip: number,
    take: number,
    where?: FindOptionsWhere<User>,
  ): Promise<[User[], number]>;
  abstract create(data: Partial<User>): User;
  abstract save(user: User): Promise<User>;
  abstract remove(user: User): Promise<User>;
}
