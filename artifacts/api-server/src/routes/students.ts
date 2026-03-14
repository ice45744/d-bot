import { Router, type IRouter } from "express";
import { db, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Register a new student (called from your website)
router.post("/register", async (req, res) => {
  const { student_id, password } = req.body;

  if (!student_id || !password) {
    res.status(400).json({ error: "student_id and password are required" });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.studentId, String(student_id)))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Student ID already registered" });
      return;
    }

    await db.insert(studentsTable).values({
      studentId: String(student_id),
      passwordHash: hashPassword(String(password)),
    });

    res.json({ success: true, message: "Student registered successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Verify student credentials (used by Discord bot internally)
router.post("/verify", async (req, res) => {
  const { student_id, password, discord_user_id } = req.body;

  if (!student_id || !password || !discord_user_id) {
    res.status(400).json({ error: "student_id, password, and discord_user_id are required" });
    return;
  }

  try {
    const students = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.studentId, String(student_id)))
      .limit(1);

    if (students.length === 0) {
      res.status(404).json({ success: false, error: "ไม่พบรหัสนักเรียนนี้ในระบบ" });
      return;
    }

    const student = students[0];

    if (student.passwordHash !== hashPassword(String(password))) {
      res.status(401).json({ success: false, error: "รหัสผ่านไม่ถูกต้อง" });
      return;
    }

    if (student.discordUserId && student.discordUserId !== String(discord_user_id)) {
      res.status(409).json({ success: false, error: "รหัสนักเรียนนี้ถูกผูกกับบัญชี Discord อื่นแล้ว" });
      return;
    }

    // Link Discord account
    await db
      .update(studentsTable)
      .set({
        discordUserId: String(discord_user_id),
        verifiedAt: new Date(),
      })
      .where(eq(studentsTable.studentId, String(student_id)));

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
        id: studentsTable.id,
        studentId: studentsTable.studentId,
        discordUserId: studentsTable.discordUserId,
        verifiedAt: studentsTable.verifiedAt,
        createdAt: studentsTable.createdAt,
      })
      .from(studentsTable);

    res.json(students);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a student (admin use)
router.delete("/:studentId", async (req, res) => {
  try {
    await db
      .delete(studentsTable)
      .where(eq(studentsTable.studentId, req.params.studentId));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
