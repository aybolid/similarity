import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  vector,
} from "drizzle-orm/pg-core";

export const files = pgTable("files", {
  fileId: serial("file_id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type DbFile = typeof files.$inferSelect;

export const filesRelations = relations(files, ({ many }) => ({
  fileChunks: many(fileChunks),
}));

export const fileChunks = pgTable(
  "file_chunks",
  {
    chunkId: serial("chunk_id").primaryKey(),
    fileId: serial("file_id").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    pageNumber: integer("page_number").notNull(),
  },
  (table) => [
    index("embedding_index").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const fileChunksRelations = relations(fileChunks, ({ one }) => ({
  file: one(files, {
    fields: [fileChunks.fileId],
    references: [files.fileId],
  }),
}));
