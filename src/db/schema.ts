import { bigint, pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const webauthnCredentials = pgTable('webauthn_credentials', {
  id: text('id').primaryKey(), // Base64URL credential ID from browser
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  publicKey: text('public_key').notNull(), // Base64URL encoded public key
  counter: bigint('counter', { mode: 'number' }).notNull().default(0),
  transports: jsonb('transports').$type<string[]>(), // JSON string e.g. '["internal","hybrid"]'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

