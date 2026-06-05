import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Paginated } from '../common/dto/paginated.dto';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  private async getOrFail(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('Email already in use');
    }
    const user = this.users.create({
      ...dto,
      password: await bcrypt.hash(dto.password, 10),
      role: UserRole.USER,
    });
    return this.users.save(user);
  }

  async findOneAuthorized(targetId: string, actor: User): Promise<User> {
    if (actor.role !== UserRole.ADMIN && actor.id !== targetId) {
      throw new ForbiddenException('Cannot view another user');
    }
    return this.getOrFail(targetId);
  }

  async findAll(query: FindUsersQueryDto): Promise<Paginated<User>> {
    const { page, limit, role } = query;
    const offset = (page - 1) * limit;
    const where = role ? { role } : {};
    const [items, totalItems] = await this.users.findAndCount(
      offset,
      limit,
      where,
    );
    const totalPages = Math.ceil(totalItems / limit);
    const nextPage = page + 1 > totalPages ? null : page + 1;
    const prevPage = page - 1 < 1 ? null : page - 1;

    return {
      items,
      meta: {
        currentPage: page,
        totalItems,
        itemsPerPage: limit,
        totalPages,
        nextPage,
        prevPage,
        itemsCount: items.length,
      },
    };
  }

  async update(
    targetId: string,
    dto: UpdateUserDto,
    actor: User,
  ): Promise<User> {
    const isAdmin = actor.role === UserRole.ADMIN;
    const isSelf = actor.id === targetId;

    if (!isAdmin && !isSelf) {
      throw new ForbiddenException('Cannot update another user');
    }
    if (dto.role !== undefined && !isAdmin) {
      throw new ForbiddenException('Only admins can change roles');
    }

    const user = await this.getOrFail(targetId);

    if (dto.email && dto.email !== user.email) {
      const clash = await this.users.findByEmail(dto.email);
      if (clash) throw new ConflictException('Email already in use');
    }
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    Object.assign(user, dto);
    return this.users.save(user);
  }

  async remove(targetId: string, actor: User): Promise<void> {
    if (actor.id === targetId) {
      throw new ForbiddenException('You cannot delete yourself');
    }
    const user = await this.getOrFail(targetId);
    await this.users.remove(user);
  }
}
