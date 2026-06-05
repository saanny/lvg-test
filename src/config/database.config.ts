import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DatabaseConfigService } from './database/database-config.service';

export const databaseConfig = (
  config: DatabaseConfigService,
): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: config.host,
  port: config.port,
  username: config.username,
  password: config.password,
  database: config.name,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
  migrationsRun: true,
});
