import { pgTable, uuid, text, timestamp, primaryKey, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").$type<"user" | "admin">().notNull().default("user"),
  status: text("status").$type<"pending" | "approved" | "rejected">().notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const memes = pgTable(
  "memes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    imageUrl: text("image_url").notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Cursor-based pagination: WHERE created_at < cursor ORDER BY created_at DESC
    index("memes_created_at_idx").on(t.createdAt.desc()),
  ],
);

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
});

export const memeTags = pgTable(
  "meme_tags",
  {
    memeId: uuid("meme_id")
      .notNull()
      .references(() => memes.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.memeId, t.tagId] }),
    // Tag lookups: composite PK only covers lookups by meme_id, this covers lookups by tag_id
    index("meme_tags_tag_id_idx").on(t.tagId),
  ],
);

export type TUser = typeof users.$inferSelect;
