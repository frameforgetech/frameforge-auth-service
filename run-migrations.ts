// Run database migrations
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '@frameforgetech/shared-contracts';

// Import migrations
import { CreateUsersTable1700000001000 } from '@frameforgetech/shared-contracts/dist/migrations/1700000001000-CreateUsersTable';
import { CreateVideoJobsTable1700000002000 } from '@frameforgetech/shared-contracts/dist/migrations/1700000002000-CreateVideoJobsTable';
import { CreateNotificationLogTable1700000003000 } from '@frameforgetech/shared-contracts/dist/migrations/1700000003000-CreateNotificationLogTable';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'frameforge',
  password: process.env.DB_PASSWORD || 'frameforge123',
  database: process.env.DB_NAME || 'frameforge',
  entities: [User],
  migrations: [
    CreateUsersTable1700000001000,
    CreateVideoJobsTable1700000002000,
    CreateNotificationLogTable1700000003000,
  ],
  synchronize: false,
  logging: true,
});

async function runMigrations() {
  try {
    console.log('Initializing database connection...');
    await AppDataSource.initialize();
    console.log('Database connected successfully');

    console.log('Running migrations...');
    await AppDataSource.runMigrations();
    console.log('Migrations completed successfully');

    await AppDataSource.destroy();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
