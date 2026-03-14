import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { pgTable, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";

const router: IRouter = Router();

// ใช้ตาราง users ที่มีอยู่แล้วใน Neon
const usersTable = pgTable("users", {
  id: varchar("id").primaryKey(),
  studentId: text("student_id").notNull(),
  name: text("name"),
  password: text("password").notNull(),
  schoolCode: text("school_code"),
  role: text("role"),
  merits: integer("merits"),
  trashPoints: integer("trash_points"),
  stamps: integer("stamps"),
  discordUserId: varchar("discord_user_id", { length: 50 }).unique(),
  verifiedAt: timestamp("verified_at"),
});

// Register a new student (called from /addstudent command)
router.post("/register", async (req, res) => {
  const { student_id, password } = req.body;

  if (!student_id || !password) {
    res.status(400).json({ error: "student_id and password are required" });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.studentId, String(student_id)))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Student ID already registered" });
      return;
    }

    const newId = crypto.randomUUID();
    await db.insert(usersTable).values({
      id: newId,
      studentId: String(student_id),
      password: String(password),
    });

    res.json({ success: true, message: "Student registered successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Verify student credentials (used by Discord bot)
router.post("/verify", async (req, res) => {
  const { student_id, password, discord_user_id } = req.body;

  if (!student_id || !password || !discord_user_id) {
    res.status(400).json({ error: "student_id, password, and discord_user_id are required" });
    return;
  }

  try {
    const students = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.studentId, String(student_id)))
      .limit(1);

    if (students.length === 0) {
      res.status(404).json({ success: false, error: "ไม่พบรหัสนักเรียนนี้ในระบบ" });
      return;
    }

    const student = students[0];

    if (student.password !== String(password)) {
      res.status(401).json({ success: false, error: "รหัสผ่านไม่ถูกต้อง" });
      return;
    }

    if (student.discordUserId && student.discordUserId !== String(discord_user_id)) {
      res.status(409).json({ success: false, error: "รหัสนักเรียนนี้ถูกผูกกับบัญชี Discord อื่นแล้ว" });
      return;
    }

    // Link Discord account
    await db
      .update(usersTable)
      .set({
        discordUserId: String(discord_user_id),
        verifiedAt: new Date(),
      })
      .where(eq(usersTable.studentId, String(student_id)));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List all students (admin use)
router.get("/", async (_req, res) => {
  try {
    const students = await db
      .select({
        id: usersTable.id,
        studentId: usersTable.studentId,
        name: usersTable.name,
        role: usersTable.role,
        discordUserId: usersTable.discordUserId,
        verifiedAt: usersTable.verifiedAt,
      })
      .from(usersTable);

    res.json(students);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a student (admin use)
router.delete("/:studentId", async (req, res) => {
  try {
    await db
      .delete(usersTable)
      .where(eq(usersTable.studentId, req.params.studentId));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
