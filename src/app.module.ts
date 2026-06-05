import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { DatabaseConfigModule } from './config/database/database-config.module';
import { DatabaseConfigService } from './config/database/database-config.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [DatabaseConfigModule],
      inject: [DatabaseConfigService],
      useFactory: databaseConfig,
    }),
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
