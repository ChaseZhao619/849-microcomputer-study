import { and, desc, eq, gte } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { accountAccess, suspendedAccountResponse } from "../../account-access";
import {
  answerEvents,
  examAttempts,
  questionProgress,
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

export async function GET(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ authenticated: false }, { status: 401 });
    const access = await accountAccess(user.id);
    if (access.suspended) return suspendedAccountResponse();
    const url = new URL(request.url);
    const days = [7, 30, 70].includes(Number(url.searchParams.get("days")))
      ? Number(url.searchParams.get("days"))
      : 70;
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - days + 1);
    const db = access.db;
    const [events, progress, exams] = await Promise.all([
      db
        .select()
        .from(answerEvents)
        .where(
          and(
            eq(answerEvents.userId, user.id),
            gte(answerEvents.activityDate, shanghaiDate(start)),
          ),
        )
        .orderBy(answerEvents.answeredAt),
      db
        .select()
        .from(questionProgress)
        .where(eq(questionProgress.userId, user.id)),
      db
        .select()
        .from(examAttempts)
        .where(eq(examAttempts.userId, user.id))
        .orderBy(desc(examAttempts.completedAt))
        .limit(10),
    ]);
    return Response.json({ authenticated: true, events, progress, exams });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "学习数据读取失败" },
      { status: 500 },
    );
  }
}
