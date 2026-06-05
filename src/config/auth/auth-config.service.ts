import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthConfigService {
  constructor(private readonly configService: ConfigService) {}

  get jwtSecret(): string {
    return this.configService.getOrThrow<string>('Auth.JWT_SECRET');
  }

  get jwtExpiresIn(): string {
    return this.configService.getOrThrow<string>('Auth.JWT_EXPIRES_IN');
  }
}
