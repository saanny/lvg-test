import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { UsersRepository } from '../users/users.repository';

export interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.usersRepository.findByEmailWithPassword(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; user: User }> {
    const user = await this.validateCredentials(email, password);
    const payload: JwtPayload = { sub: user.id, role: user.role };
    return { accessToken: await this.jwtService.signAsync(payload), user };
  }
}
