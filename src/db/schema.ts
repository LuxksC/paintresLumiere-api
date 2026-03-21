import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum
} from 'drizzle-orm/pg-core';

export const userType = pgEnum('user_type', [
  'admin',
  'client'
]);

export const usersTable = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  lastname: varchar('lastname', { length: 255 }),
  type: userType().notNull().default('client'),
  phone: varchar({ length: 20 }),
  cpf: varchar({ length: 14 }).unique(),
  cnpj: varchar({ length: 14 }).unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});
