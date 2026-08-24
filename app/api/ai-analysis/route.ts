import { and, count, eq, gte, lt } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { accountAccess, suspendedAccountResponse } from "../../account-access";
import {
  aiAnalysisEvents,
  aiRequestLocks,
  examSessions,
} from "../../../db/schema";
import { questions } from "../../question-bank";

export const dynamic = "force-dynamic";
type Provider = "openai" | "qwen" | "deepseek";
const endpoints: Record<Provider, string> = {
  openai: "https://api.openai.com/v1/responses",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
};

const resultSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    transcript: { type: "string" },
    suggestedRubricIds: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["transcript", "suggestedRubricIds", "warnings"],
};

function parseJson(value: string) {
  const cleaned = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as {
    transcript?: unknown;
    suggestedRubricIds?: unknown;
    warnings?: unknown;
  };
  return {
    transcript: String(parsed.transcript ?? ""),
    suggestedRubricIds: Array.isArray(parsed.suggestedRubricIds)
      ? parsed.suggestedRubricIds.map(String)
      : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
  };
}

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output)
    ? (payload.output as Array<Record<string, unknown>>)
    : [];
  for (const item of output)
    for (const content of Array.isArray(item.content)
      ? (item.content as Array<Record<string, unknown>>)
      : [])
      if (typeof content.text === "string") return content.text;
  return "";
}

export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user)
      return Response.json({ error: "请先登录后使用AI识别" }, { status: 401 });
    const access = await accountAccess(user.id);
    if (access.suspended) return suspendedAccountResponse();
    const body = (await request.json()) as Record<string, unknown>;
    const provider = String(body.provider || "") as Provider;
    if (!(provider in endpoints))
      return Response.json({ error: "不支持的模型平台" }, { status: 400 });
    const token = String(body.token || "");
    const model = String(body.model || "")
      .trim()
      .slice(0, 80);
    const examId = String(body.examId || "");
    const questionId = Number(body.questionId);
    const phase = body.phase === "review" ? "review" : "active";
    const images = Array.isArray(body.images)
      ? body.images
          .map(String)
          .filter((item) => /^data:image\/(jpeg|png|webp);base64,/.test(item))
          .slice(0, 6)
      : [];
    const transcript = String(body.transcript || "").slice(0, 12000);
    if (token.length < 8 || !model || !examId || !Number.isInteger(questionId))
      return Response.json(
        { error: "模型配置或试卷信息不完整" },
        { status: 400 },
      );
    if (images.reduce((sum, item) => sum + item.length, 0) > 13_000_000)
      return Response.json(
        { error: "待识别图片总量过大，请减少图片或重新压缩" },
        { status: 413 },
      );
    if (provider === "deepseek" && (!transcript || images.length))
      return Response.json(
        { error: "DeepSeek仅支持对已转写文字进行复核" },
        { status: 400 },
      );
    if (provider !== "deepseek" && !images.length && !transcript)
      return Response.json(
        { error: "没有可识别的笔迹或文字" },
        { status: 400 },
      );
    const db = access.db;
    const [session] = await db
      .select({
        id: examSessions.id,
        status: examSessions.status,
        questionIdsJson: examSessions.questionIdsJson,
      })
      .from(examSessions)
      .where(and(eq(examSessions.id, examId), eq(examSessions.userId, user.id)))
      .limit(1);
    if (!session)
      return Response.json(
        { error: "试卷尚未完成同步，请稍后再试" },
        { status: 403 },
      );
    if (!JSON.parse(session.questionIdsJson).map(Number).includes(questionId))
      return Response.json({ error: "题目不属于这套试卷" }, { status: 403 });
    const [usage] = await db
      .select({ value: count() })
      .from(aiAnalysisEvents)
      .where(
        and(
          eq(aiAnalysisEvents.userId, user.id),
          gte(
            aiAnalysisEvents.createdAt,
            new Date(Date.now() - 3600000).toISOString(),
          ),
        ),
      );
    if (Number(usage?.value || 0) >= 30)
      return Response.json(
        { error: "本小时识别次数已达30次，请稍后再试" },
        { status: 429 },
      );
    const question = questions.find((item) => item.id === questionId);
    if (!question)
      return Response.json({ error: "题目不存在" }, { status: 404 });
    await db
      .delete(aiRequestLocks)
      .where(
        and(
          eq(aiRequestLocks.userId, user.id),
          lt(
            aiRequestLocks.createdAt,
            new Date(Date.now() - 120000).toISOString(),
          ),
        ),
      );
    const requestId = crypto.randomUUID();
    await db
      .insert(aiRequestLocks)
      .values({
        userId: user.id,
        requestId,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing();
    const [lock] = await db
      .select()
      .from(aiRequestLocks)
      .where(eq(aiRequestLocks.userId, user.id))
      .limit(1);
    if (lock?.requestId !== requestId)
      return Response.json(
        { error: "已有一个识别请求正在进行，请等待完成" },
        { status: 429 },
      );
    const allowReview = phase === "review" && session.status !== "active";
    const rubric = allowReview
      ? (question.rubric?.map((item) => ({
          id: item.id,
          label: item.label,
          points: item.points,
        })) ?? [])
      : [];
    const instruction = allowReview
      ? `请转写考生答案，并仅根据以下评分量规指出可能命中的评分点。不要直接给总分，不确定内容放入warnings。题目：${question.prompt}\n参考答案：${question.answer}\n评分量规：${JSON.stringify(rubric)}`
      : "你是考试答题转写工具。只转写图片或笔迹中的原文、公式、汇编代码和图示标签；不要解题、补全答案、评价正误或提供提示。suggestedRubricIds必须为空数组。";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    let result: {
      transcript: string;
      suggestedRubricIds: string[];
      warnings: string[];
    };
    try {
      if (provider === "openai") {
        const content = [
          {
            type: "input_text",
            text: `${instruction}\n已有文字：${transcript}`,
          },
          ...images.map((image_url) => ({ type: "input_image", image_url })),
        ];
        const response = await fetch(endpoints.openai, {
          method: "POST",
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            store: false,
            input: [{ role: "user", content }],
            text: {
              format: {
                type: "json_schema",
                name: "handwriting_analysis",
                strict: true,
                schema: resultSchema,
              },
            },
          }),
        });
        const payload = (await response.json()) as Record<string, unknown>;
        if (!response.ok)
          throw new Error(`OpenAI请求失败（${response.status}）`);
        result = parseJson(outputText(payload));
      } else {
        const content =
          provider === "qwen"
            ? [
                {
                  type: "text",
                  text: `${instruction}\n已有文字：${transcript}\n请输出JSON：${JSON.stringify({ transcript: "", suggestedRubricIds: [], warnings: [] })}`,
                },
                ...images.map((url) => ({
                  type: "image_url",
                  image_url: { url },
                })),
              ]
            : `${instruction}\n待复核转写：${transcript}\n请输出JSON：${JSON.stringify({ transcript: "", suggestedRubricIds: [], warnings: [] })}`;
        const response = await fetch(endpoints[provider], {
          method: "POST",
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content }],
            response_format: { type: "json_object" },
            stream: false,
          }),
        });
        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        if (!response.ok)
          throw new Error(
            `${provider === "qwen" ? "千问" : "DeepSeek"}请求失败（${response.status}）`,
          );
        result = parseJson(payload.choices?.[0]?.message?.content ?? "");
      }
    } finally {
      clearTimeout(timeout);
      await db
        .delete(aiRequestLocks)
        .where(
          and(
            eq(aiRequestLocks.userId, user.id),
            eq(aiRequestLocks.requestId, requestId),
          ),
        );
    }
    const allowedRubricIds = new Set(rubric.map((item) => item.id));
    result.suggestedRubricIds = allowReview
      ? result.suggestedRubricIds.filter((id) => allowedRubricIds.has(id))
      : [];
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 180 * 86400000).toISOString();
    await db
      .insert(aiAnalysisEvents)
      .values({
        id,
        userId: user.id,
        examId,
        questionId,
        provider,
        model,
        phase,
        transcript: result.transcript,
        resultJson: JSON.stringify(result),
        expiresAt,
      });
    return Response.json(
      {
        analysis: {
          id,
          provider,
          model,
          ...result,
          createdAt: new Date().toISOString(),
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "模型响应超时，未自动重试"
        : error instanceof Error
          ? error.message
          : "AI识别失败";
    return Response.json(
      { error: message },
      {
        status: message.includes("超时") ? 504 : 500,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
