import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import {
  answerEvents,
  examAttempts,
  questionProgress,
  studyPlanCompletions,
  studyPlans,
  userProfiles,
} from "../../../db/schema";

export const dynamic = "force-dynamic";

function shanghaiDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

async function requireApiUser() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const db = getDb();
  await db.insert(userProfiles).values({
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    studyId: `849-${crypto.randomUUID().slice(0, 8)}`,
  }).onConflictDoUpdate({
    target: userProfiles.userId,
    set: { email: user.email, displayName: user.displayName, updatedAt: new Date().toISOString() },
  });
  await db.update(userProfiles)
    .set({ studyId: `849-${crypto.randomUUID().slice(0, 8)}` })
    .where(and(eq(userProfiles.userId, user.id), isNull(userProfiles.studyId)));
  return { user, db };
}

export async function GET() {
  try {
    const context = await requireApiUser();
    if (!context) return Response.json({ authenticated: false }, { status: 401 });
    const { user, db } = context;
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 69);
    const startDate = shanghaiDate(start);
    const [profile, progress, plans, exams, activity] = await Promise.all([
      db.select().from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1),
      db.select().from(questionProgress).where(eq(questionProgress.userId, user.id)),
      db.select().from(studyPlans).where(eq(studyPlans.userId, user.id)).orderBy(desc(studyPlans.planDate)).limit(30),
      db.select().from(examAttempts).where(eq(examAttempts.userId, user.id)).orderBy(desc(examAttempts.completedAt)).limit(10),
      db.select({
        date: answerEvents.activityDate,
        count: sql<number>`count(*)`,
      }).from(answerEvents)
        .where(and(eq(answerEvents.userId, user.id), gte(answerEvents.activityDate, startDate)))
        .groupBy(answerEvents.activityDate),
    ]);
    const savedProfile = profile[0];
    return Response.json({
      authenticated: true,
      user: {
        displayName: savedProfile?.nickname || user.displayName,
        baseDisplayName: user.displayName,
        email: user.email,
        studyId: savedProfile?.studyId,
        bio: savedProfile?.bio || "",
      },
      profile: savedProfile,
      progress,
      plans,
      exams,
      activity,
    });
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
      const updates: Partial<typeof userProfiles.$inferInsert> = { updatedAt: new Date().toISOString() };
      if ("dailyGoal" in body) updates.dailyGoal = Math.min(100, Math.max(5, Number(body.dailyGoal) || 20));
      if ("examDate" in body) updates.examDate = String(body.examDate || "2026-12-19");
      if ("nickname" in body) updates.nickname = String(body.nickname || "").trim().slice(0, 24) || null;
      if ("bio" in body) updates.bio = String(body.bio || "").trim().slice(0, 80);
      if ("studyId" in body) {
        const studyId = String(body.studyId || "").trim().toLowerCase();
        if (!/^[a-z0-9_-]{4,24}$/.test(studyId)) {
          return Response.json({ error: "学习 ID 需为 4–24 位字母、数字、短横线或下划线" }, { status: 400 });
        }
        updates.studyId = studyId;
      }
      await db.update(userProfiles).set(updates).where(eq(userProfiles.userId, user.id));
      const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1);
      return Response.json({ ok: true, profile });
    }

    if (body.action === "progress") {
      const questionId = Number(body.questionId);
      if (!Number.isInteger(questionId)) return Response.json({ error: "题目编号无效" }, { status: 400 });
      const eventId = String(body.eventId || crypto.randomUUID());
      const existingEvent = await db.select({ id: answerEvents.id, userId: answerEvents.userId })
        .from(answerEvents)
        .where(eq(answerEvents.id, eventId))
        .limit(1);
      if (existingEvent.length) {
        if (existingEvent[0].userId !== user.id) return Response.json({ error: "事件编号冲突" }, { status: 409 });
        return Response.json({ ok: true, duplicate: true });
      }

      const status = String(body.status || "unsure");
      const correct = Boolean(body.correct);
      const reviewStage = Math.max(0, Number(body.reviewStage) || 0);
      const nextReviewAt = body.nextReviewAt ? String(body.nextReviewAt) : null;
      const answeredAt = body.answeredAt ? new Date(String(body.answeredAt)) : new Date();
      const safeAnsweredAt = Number.isNaN(answeredAt.getTime()) ? new Date() : answeredAt;
      const existing = await db.select().from(questionProgress)
        .where(and(eq(questionProgress.userId, user.id), eq(questionProgress.questionId, questionId)))
        .limit(1);

      await db.insert(answerEvents).values({
        id: eventId,
        userId: user.id,
        questionId,
        source: String(body.source || "practice"),
        correct,
        answeredAt: safeAnsweredAt.toISOString(),
        activityDate: shanghaiDate(safeAnsweredAt),
      }).onConflictDoNothing();

      await db.insert(questionProgress).values({
        userId: user.id,
        questionId,
        status,
        attempts: 1,
        correctAttempts: correct ? 1 : 0,
        reviewStage,
        nextReviewAt,
      }).onConflictDoUpdate({
        target: [questionProgress.userId, questionProgress.questionId],
        set: {
          status,
          attempts: (existing[0]?.attempts ?? 0) + 1,
          correctAttempts: (existing[0]?.correctAttempts ?? 0) + (correct ? 1 : 0),
          reviewStage,
          nextReviewAt,
          lastAnsweredAt: safeAnsweredAt.toISOString(),
        },
      });

      let updatedPlan = null;
      const planId = Number(body.planId);
      if (Number.isInteger(planId) && planId > 0) {
        const [plan] = await db.select().from(studyPlans)
          .where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, user.id)))
          .limit(1);
        if (plan) {
          await db.insert(studyPlanCompletions).values({
            planId,
            userId: user.id,
            questionId,
          }).onConflictDoNothing();
          const [summary] = await db.select({ count: sql<number>`count(*)` })
            .from(studyPlanCompletions)
            .where(and(eq(studyPlanCompletions.planId, planId), eq(studyPlanCompletions.userId, user.id)));
          const completedQuestions = Math.min(plan.targetQuestions, Number(summary?.count || 0));
          const planStatus = completedQuestions >= plan.targetQuestions ? "completed" : "pending";
          await db.update(studyPlans).set({ completedQuestions, status: planStatus })
            .where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, user.id)));
          updatedPlan = { ...plan, completedQuestions, status: planStatus };
        }
      }
      return Response.json({ ok: true, plan: updatedPlan });
    }

    if (body.action === "status") {
      const questionId = Number(body.questionId);
      if (!Number.isInteger(questionId)) return Response.json({ error: "题目编号无效" }, { status: 400 });
      const status = String(body.status || "unsure");
      const reviewStage = Math.max(0, Number(body.reviewStage) || 0);
      const nextReviewAt = body.nextReviewAt ? String(body.nextReviewAt) : null;
      await db.insert(questionProgress).values({
        userId: user.id,
        questionId,
        status,
        attempts: 0,
        correctAttempts: 0,
        reviewStage,
        nextReviewAt,
      }).onConflictDoUpdate({
        target: [questionProgress.userId, questionProgress.questionId],
        set: { status, reviewStage, nextReviewAt },
      });
      return Response.json({ ok: true });
    }

    if (body.action === "plan") {
      const planDate = String(body.planDate || shanghaiDate());
      const chapter = String(body.chapter || "综合复习");
      const targetQuestions = Math.min(100, Math.max(1, Number(body.targetQuestions) || 20));
      const completedQuestions = Math.min(targetQuestions, Math.max(0, Number(body.completedQuestions) || 0));
      const status = completedQuestions >= targetQuestions ? "completed" : "pending";
      await db.insert(studyPlans).values({
        userId: user.id,
        planDate,
        chapter,
        targetQuestions,
        completedQuestions,
        status,
      }).onConflictDoUpdate({
        target: [studyPlans.userId, studyPlans.planDate, studyPlans.chapter],
        set: { targetQuestions, completedQuestions, status },
      });
      const [plan] = await db.select().from(studyPlans)
        .where(and(eq(studyPlans.userId, user.id), eq(studyPlans.planDate, planDate), eq(studyPlans.chapter, chapter)))
        .limit(1);
      return Response.json({ ok: true, plan });
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
      }).onConflictDoNothing();
      return Response.json({ ok: true, id });
    }

    return Response.json({ error: "不支持的同步操作" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "账户数据写入失败";
    if (message.includes("UNIQUE constraint failed") && message.includes("study_id")) {
      return Response.json({ error: "这个学习 ID 已被使用，请换一个" }, { status: 409 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
