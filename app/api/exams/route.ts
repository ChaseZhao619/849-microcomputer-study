import { and, desc, eq, inArray } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import {
  aiAnalysisEvents,
  examAnswerAssets,
  examSessions,
} from "../../../db/schema";
import { getAnswerAssets } from "../../../db/storage";

export const dynamic = "force-dynamic";

async function context() {
  const user = await getChatGPTUser();
  if (!user) return null;
  return { user, db: getDb() };
}

export async function GET() {
  try {
    const current = await context();
    if (!current)
      return Response.json({ authenticated: false }, { status: 401 });
    const sessions = await current.db
      .select()
      .from(examSessions)
      .where(
        and(
          eq(examSessions.userId, current.user.id),
          inArray(examSessions.status, ["active", "paused", "reviewing"]),
        ),
      )
      .orderBy(desc(examSessions.updatedAt))
      .limit(5);
    return Response.json({ authenticated: true, sessions });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "试卷读取失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const current = await context();
    if (!current)
      return Response.json({ error: "请先登录后同步试卷" }, { status: 401 });
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "save");
    if (
      !["create", "save", "pause", "resume", "submit", "selfScore"].includes(
        action,
      )
    ) {
      return Response.json({ error: "不支持的试卷操作" }, { status: 400 });
    }
    const id = String(body.id || crypto.randomUUID());
    const questionIds = Array.isArray(body.questionIds)
      ? body.questionIds.map(Number).filter(Number.isInteger)
      : [];
    if (!questionIds.length)
      return Response.json({ error: "试卷题目不能为空" }, { status: 400 });
    const [existing] = await current.db
      .select({ userId: examSessions.userId })
      .from(examSessions)
      .where(eq(examSessions.id, id))
      .limit(1);
    if (existing && existing.userId !== current.user.id) {
      return Response.json({ error: "试卷编号冲突" }, { status: 409 });
    }
    const now = new Date().toISOString();
    const status =
      action === "pause"
        ? "paused"
        : action === "submit"
          ? "reviewing"
          : action === "selfScore"
            ? "completed"
            : "active";
    const values = {
      id,
      userId: current.user.id,
      scope: String(body.scope || "全部章节"),
      questionIdsJson: JSON.stringify(questionIds),
      answersJson: JSON.stringify(body.answers || {}),
      selfScoresJson: JSON.stringify(body.selfScores || {}),
      currentIndex: Math.max(0, Number(body.currentIndex) || 0),
      durationSeconds: Math.max(60, Number(body.durationSeconds) || 1800),
      remainingSeconds: Math.max(0, Number(body.remainingSeconds) || 0),
      deadlineAt: body.deadlineAt ? String(body.deadlineAt) : null,
      status,
      score: Math.max(0, Number(body.score) || 0),
      total: Math.max(0, Number(body.total) || questionIds.length),
      startedAt: String(body.startedAt || now),
      updatedAt: now,
      completedAt: status === "completed" ? now : null,
    };
    await current.db
      .insert(examSessions)
      .values(values)
      .onConflictDoUpdate({
        target: examSessions.id,
        set: {
          scope: values.scope,
          questionIdsJson: values.questionIdsJson,
          answersJson: values.answersJson,
          selfScoresJson: values.selfScoresJson,
          currentIndex: values.currentIndex,
          durationSeconds: values.durationSeconds,
          remainingSeconds: values.remainingSeconds,
          deadlineAt: values.deadlineAt,
          status: values.status,
          score: values.score,
          total: values.total,
          updatedAt: now,
          completedAt: values.completedAt,
        },
      });
    const [session] = await current.db
      .select()
      .from(examSessions)
      .where(
        and(eq(examSessions.id, id), eq(examSessions.userId, current.user.id)),
      )
      .limit(1);
    return Response.json({ ok: true, session });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "试卷保存失败" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const current = await context();
    if (!current) return Response.json({ error: "请先登录" }, { status: 401 });
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "缺少试卷编号" }, { status: 400 });
    const [session] = await current.db
      .select({ id: examSessions.id })
      .from(examSessions)
      .where(
        and(eq(examSessions.id, id), eq(examSessions.userId, current.user.id)),
      )
      .limit(1);
    if (!session)
      return Response.json({ error: "试卷不存在" }, { status: 404 });
    const assets = await current.db
      .select({ objectKey: examAnswerAssets.objectKey })
      .from(examAnswerAssets)
      .where(
        and(
          eq(examAnswerAssets.examId, id),
          eq(examAnswerAssets.userId, current.user.id),
        ),
      );
    if (assets.length)
      await getAnswerAssets().delete(assets.map((asset) => asset.objectKey));
    await current.db
      .delete(aiAnalysisEvents)
      .where(
        and(
          eq(aiAnalysisEvents.examId, id),
          eq(aiAnalysisEvents.userId, current.user.id),
        ),
      );
    await current.db
      .delete(examAnswerAssets)
      .where(
        and(
          eq(examAnswerAssets.examId, id),
          eq(examAnswerAssets.userId, current.user.id),
        ),
      );
    await current.db
      .delete(examSessions)
      .where(
        and(eq(examSessions.id, id), eq(examSessions.userId, current.user.id)),
      );
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "删除试卷失败" },
      { status: 500 },
    );
  }
}
