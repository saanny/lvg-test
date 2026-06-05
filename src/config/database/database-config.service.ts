import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseConfigService {
  constructor(private readonly configService: ConfigService) {}

  get host(): string {
    return this.configService.getOrThrow<string>('Database.DB_HOST');
  }

  get port(): number {
    return parseInt(
      this.configService.getOrThrow<string>('Database.DB_PORT'),
      10,
    );
  }

  get username(): string {
    return this.configService.getOrThrow<string>('Database.DB_USER');
  }

  get password(): string {
    return this.configService.getOrThrow<string>('Database.DB_PASSWORD');
  }

  get name(): string {
    return this.configService.getOrThrow<string>('Database.DB_NAME');
  }
}
