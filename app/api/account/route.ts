import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { examAttempts, questionProgress, studyPlans, userProfiles } from "../../../db/schema";

export const dynamic = "force-dynamic";

async function requireApiUser() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const db = getDb();
  await db.insert(userProfiles).values({
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
  }).onConflictDoUpdate({
    target: userProfiles.userId,
    set: { email: user.email, displayName: user.displayName, updatedAt: new Date().toISOString() },
  });
  return { user, db };
}

export async function GET() {
  try {
    const context = await requireApiUser();
    if (!context) return Response.json({ authenticated: false }, { status: 401 });
    const { user, db } = context;
    const [profile, progress, plans, exams] = await Promise.all([
      db.select().from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1),
      db.select().from(questionProgress).where(eq(questionProgress.userId, user.id)),
      db.select().from(studyPlans).where(eq(studyPlans.userId, user.id)).orderBy(desc(studyPlans.planDate)).limit(30),
      db.select().from(examAttempts).where(eq(examAttempts.userId, user.id)).orderBy(desc(examAttempts.completedAt)).limit(10),
    ]);
    return Response.json({ authenticated: true, user: { displayName: user.displayName, email: user.email }, profile: profile[0], progress, plans, exams });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "账户数据读取失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireApiUser();
    if (!context) return Response.json({ error: "请先登录 ChatGPT 账户" }, { status: 401 });
    const { user, db } = context;
    const body = await request.json() as Record<string, unknown>;

    if (body.action === "profile") {
      const dailyGoal = Math.min(100, Math.max(5, Number(body.dailyGoal) || 20));
      const examDate = String(body.examDate || "2026-12-19");
      await db.update(userProfiles).set({ dailyGoal, examDate, updatedAt: new Date().toISOString() }).where(eq(userProfiles.userId, user.id));
      return Response.json({ ok: true });
    }

    if (body.action === "progress") {
      const questionId = Number(body.questionId);
      if (!Number.isInteger(questionId)) return Response.json({ error: "题目编号无效" }, { status: 400 });
      const status = String(body.status || "unsure");
      const correct = Boolean(body.correct);
      const reviewStage = Math.max(0, Number(body.reviewStage) || 0);
      const nextReviewAt = body.nextReviewAt ? String(body.nextReviewAt) : null;
      const existing = await db.select().from(questionProgress).where(and(eq(questionProgress.userId, user.id), eq(questionProgress.questionId, questionId))).limit(1);
      await db.insert(questionProgress).values({
        userId: user.id, questionId, status, attempts: 1, correctAttempts: correct ? 1 : 0, reviewStage, nextReviewAt,
      }).onConflictDoUpdate({
        target: [questionProgress.userId, questionProgress.questionId],
        set: {
          status,
          attempts: (existing[0]?.attempts ?? 0) + 1,
          correctAttempts: (existing[0]?.correctAttempts ?? 0) + (correct ? 1 : 0),
          reviewStage,
          nextReviewAt,
          lastAnsweredAt: new Date().toISOString(),
        },
      });
      return Response.json({ ok: true });
    }

    if (body.action === "plan") {
      const planDate = String(body.planDate || new Date().toISOString().slice(0, 10));
      const chapter = String(body.chapter || "综合复习");
      const targetQuestions = Math.min(100, Math.max(1, Number(body.targetQuestions) || 20));
      const completedQuestions = Math.min(targetQuestions, Math.max(0, Number(body.completedQuestions) || 0));
      const status = completedQuestions >= targetQuestions ? "completed" : "pending";
      await db.insert(studyPlans).values({ userId: user.id, planDate, chapter, targetQuestions, completedQuestions, status }).onConflictDoUpdate({
        target: [studyPlans.userId, studyPlans.planDate, studyPlans.chapter],
        set: { targetQuestions, completedQuestions, status },
      });
      return Response.json({ ok: true });
    }

    if (body.action === "exam") {
      const id = String(body.id || crypto.randomUUID());
      await db.insert(examAttempts).values({
        id,
        userId: user.id,
        scope: String(body.scope || "全范围"),
        questionIdsJson: JSON.stringify(body.questionIds || []),
        answersJson: JSON.stringify(body.answers || {}),
        score: Math.max(0, Number(body.score) || 0),
        total: Math.max(1, Number(body.total) || 1),
        durationSeconds: Math.max(0, Number(body.durationSeconds) || 0),
      });
      return Response.json({ ok: true, id });
    }

    return Response.json({ error: "不支持的同步操作" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "账户数据写入失败" }, { status: 500 });
  }
}
