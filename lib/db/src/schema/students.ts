import { pgTable, serial, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id", { length: 50 }).unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  discordUserId: varchar("discord_user_id", { length: 50 }).unique(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
