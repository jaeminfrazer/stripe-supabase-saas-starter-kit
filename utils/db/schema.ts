
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users_table', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    plan: text('plan').notNull(),
    stripe_id: text('stripe_id').notNull(),
    beta_access_expires_at: timestamp('beta_access_expires_at', {
        withTimezone: true,
    }),
});

export const betaPurchases = pgTable('beta_purchases', {
    id: uuid('id').primaryKey().defaultRandom(),
    stripe_checkout_session_id: text('stripe_checkout_session_id').notNull().unique(),
    email: text('email').notNull(),
    payment_status: text('payment_status').notNull().default('pending'),
    purchased_at: timestamp('purchased_at', { withTimezone: true }),
    expires_at: timestamp('expires_at', { withTimezone: true }),
    claimed_user_id: text('claimed_user_id'),
    claimed_at: timestamp('claimed_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;
export type InsertBetaPurchase = typeof betaPurchases.$inferInsert;
export type SelectBetaPurchase = typeof betaPurchases.$inferSelect;
