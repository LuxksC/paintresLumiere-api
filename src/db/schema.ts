import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  jsonb,
  integer,
  numeric,
  doublePrecision,
  index,
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
  password: varchar('password', { length: 255 }),
  googleSub: varchar('google_sub', { length: 255 }).unique(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const productColor = pgEnum('product_color', [
  'gold',
  'silver',
  'bronze',
  'rose',
  'transparent',
  'black',
]);

export const productCategory = pgEnum('product_category', [
  'names',
  'numbers',
  'images',
  'letters',
]);

export const productStatus = pgEnum('product_status', [
  'active',
  'inactive',
  'out_of_stock',
]);

export const productsTable = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  sku: varchar('sku', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  images: jsonb('images').$type<string[]>().default([]),
  stockQuantity: integer('stock_quantity').default(0),
  category: productCategory('category').notNull(),
  sellingPrice: numeric('selling_price', { precision: 10, scale: 2 }).notNull(),
  productionCost: numeric('production_cost', { precision: 10, scale: 2 }),
  discountRate: numeric('discount_rate', { precision: 3, scale: 2 }).default('0.00'),
  color: productColor('color').notNull(),
  height: doublePrecision('height'),
  width: doublePrecision('width'),
  length: doublePrecision('length'),
  thickness: doublePrecision('thickness').default(3.0),
  dimensionsUnit: varchar('dimensions_unit', { length: 10 }).default('mm'),
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  barcode: varchar('barcode', { length: 14 }),
  status: productStatus('status').default('active'),
  salesCount: integer('sales_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_products_sku').on(table.sku),
]);
