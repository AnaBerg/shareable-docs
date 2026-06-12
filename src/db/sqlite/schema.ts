import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const nowIso = () => new Date().toISOString();

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    primaryEmail: text("primary_email"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    imageUrl: text("image_url"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("users_clerk_user_id_unique").on(table.clerkUserId),
    index("users_primary_email_idx").on(table.primaryEmail),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
