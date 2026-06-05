import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { authConfiguration } from './config/auth/auth-configuration';
import { databaseConfiguration } from './config/database/database-configuration';
import { databaseConfig } from './config/database.config';
import { DatabaseConfigModule } from './config/database/database-config.module';
import { DatabaseConfigService } from './config/database/database-config.service';
import { envValidationSchema } from './config/env.validation';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
      load: [databaseConfiguration, authConfiguration],
      validationSchema: envValidationSchema,
    }),
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
