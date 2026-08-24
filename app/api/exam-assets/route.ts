import { and, eq, lt } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { accountAccess, suspendedAccountResponse } from "../../account-access";
import { getAnswerAssets } from "../../../db/storage";
import { examAnswerAssets, examSessions } from "../../../db/schema";

export const dynamic = "force-dynamic";
const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/json",
]);

async function userContext() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const access = await accountAccess(user.id);
  return {
    user,
    db: access.db,
    bucket: getAnswerAssets(),
    suspended: access.suspended,
  };
}

async function purgeExpired(
  context: NonNullable<Awaited<ReturnType<typeof userContext>>>,
) {
  const expired = await context.db
    .select()
    .from(examAnswerAssets)
    .where(
      and(
        eq(examAnswerAssets.userId, context.user.id),
        lt(examAnswerAssets.expiresAt, new Date().toISOString()),
      ),
    )
    .limit(30);
  await Promise.all(
    expired.map((asset) => context.bucket.delete(asset.objectKey)),
  );
  for (const asset of expired)
    await context.db
      .delete(examAnswerAssets)
      .where(
        and(
          eq(examAnswerAssets.id, asset.id),
          eq(examAnswerAssets.userId, context.user.id),
        ),
      );
}

async function ownsExam(
  context: NonNullable<Awaited<ReturnType<typeof userContext>>>,
  examId: string,
) {
  const [session] = await context.db
    .select({
      id: examSessions.id,
      questionIdsJson: examSessions.questionIdsJson,
    })
    .from(examSessions)
    .where(
      and(
        eq(examSessions.id, examId),
        eq(examSessions.userId, context.user.id),
      ),
    )
    .limit(1);
  return session ?? null;
}

export async function GET(request: Request) {
  try {
    const context = await userContext();
    if (!context) return Response.json({ error: "请先登录" }, { status: 401 });
    if (context.suspended) return suspendedAccountResponse();
    await purgeExpired(context);
    const id = new URL(request.url).searchParams.get("id");
    const examId = new URL(request.url).searchParams.get("examId");
    const questionId = Number(
      new URL(request.url).searchParams.get("questionId"),
    );
    if (id) {
      const [asset] = await context.db
        .select()
        .from(examAnswerAssets)
        .where(
          and(
            eq(examAnswerAssets.id, id),
            eq(examAnswerAssets.userId, context.user.id),
          ),
        )
        .limit(1);
      if (!asset || asset.expiresAt < new Date().toISOString())
        return Response.json({ error: "附件不存在或已过期" }, { status: 404 });
      const object = await context.bucket.get(asset.objectKey);
      if (!object)
        return Response.json({ error: "附件文件不存在" }, { status: 404 });
      return new Response(object.body, {
        headers: {
          "content-type": asset.mimeType,
          "cache-control": "private, no-store",
          "content-disposition": `inline; filename="${encodeURIComponent(asset.filename)}"`,
        },
      });
    }
    const session = examId ? await ownsExam(context, examId) : null;
    if (
      !examId ||
      !Number.isInteger(questionId) ||
      !session ||
      !JSON.parse(session.questionIdsJson).map(Number).includes(questionId)
    )
      return Response.json({ error: "试卷信息无效" }, { status: 403 });
    const assets = await context.db
      .select()
      .from(examAnswerAssets)
      .where(
        and(
          eq(examAnswerAssets.userId, context.user.id),
          eq(examAnswerAssets.examId, examId),
          eq(examAnswerAssets.questionId, questionId),
        ),
      );
    return Response.json({
      assets: assets.map((asset) => ({
        ...asset,
        url: `/api/exam-assets?id=${encodeURIComponent(asset.id)}`,
      })),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "附件读取失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const context = await userContext();
  if (!context)
    return Response.json({ error: "请先登录后上传" }, { status: 401 });
  if (context.suspended) return suspendedAccountResponse();
  try {
    await purgeExpired(context);
    const form = await request.formData();
    const examId = String(form.get("examId") || "");
    const questionId = Number(form.get("questionId"));
    const kind = form.get("kind") === "canvas" ? "canvas" : "photo";
    const file = form.get("file");
    if (!examId || !Number.isInteger(questionId) || !(file instanceof File))
      return Response.json({ error: "附件参数不完整" }, { status: 400 });
    const session = await ownsExam(context, examId);
    if (
      !session ||
      !JSON.parse(session.questionIdsJson).map(Number).includes(questionId)
    )
      return Response.json(
        { error: "无权修改这道试题的附件" },
        { status: 403 },
      );
    const existing = await context.db
      .select({ id: examAnswerAssets.id, kind: examAnswerAssets.kind })
      .from(examAnswerAssets)
      .where(
        and(
          eq(examAnswerAssets.userId, context.user.id),
          eq(examAnswerAssets.examId, examId),
          eq(examAnswerAssets.questionId, questionId),
        ),
      );
    if (
      kind === "photo" &&
      existing.filter((item) => item.kind === "photo").length >= 6
    )
      return Response.json({ error: "每题最多保存6张图片" }, { status: 413 });
    if (!allowedTypes.has(file.type) || file.size > 1_500_000)
      return Response.json(
        { error: "仅支持JPG、PNG、WebP或笔迹JSON，且单个不超过1.5MB" },
        { status: 415 },
      );
    const id = crypto.randomUUID();
    const extension =
      file.type === "application/json"
        ? "json"
        : file.type.split("/")[1].replace("jpeg", "jpg");
    const objectKey = `answers/${context.user.id}/${examId}/${questionId}/${id}.${extension}`;
    await context.bucket.put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type },
    });
    const expiresAt = new Date(Date.now() + 180 * 86400000).toISOString();
    try {
      await context.db
        .insert(examAnswerAssets)
        .values({
          id,
          userId: context.user.id,
          examId,
          questionId,
          kind,
          objectKey,
          filename: file.name.slice(0, 120) || `answer.${extension}`,
          mimeType: file.type,
          sizeBytes: file.size,
          expiresAt,
        });
    } catch (error) {
      await context.bucket.delete(objectKey);
      throw error;
    }
    if (kind === "canvas")
      for (const prior of existing.filter((item) => item.kind === "canvas")) {
        const [row] = await context.db
          .select({ objectKey: examAnswerAssets.objectKey })
          .from(examAnswerAssets)
          .where(eq(examAnswerAssets.id, prior.id))
          .limit(1);
        if (row) await context.bucket.delete(row.objectKey);
        await context.db
          .delete(examAnswerAssets)
          .where(eq(examAnswerAssets.id, prior.id));
      }
    return Response.json({
      asset: {
        id,
        kind,
        name: file.name,
        mimeType: file.type,
        previewUrl: `/api/exam-assets?id=${encodeURIComponent(id)}`,
        remote: true,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "附件上传失败" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const context = await userContext();
  if (!context) return Response.json({ error: "请先登录" }, { status: 401 });
  if (context.suspended) return suspendedAccountResponse();
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "附件编号为空" }, { status: 400 });
    const [asset] = await context.db
      .select()
      .from(examAnswerAssets)
      .where(
        and(
          eq(examAnswerAssets.id, id),
          eq(examAnswerAssets.userId, context.user.id),
        ),
      )
      .limit(1);
    if (!asset) return Response.json({ ok: true });
    await context.bucket.delete(asset.objectKey);
    await context.db
      .delete(examAnswerAssets)
      .where(
        and(
          eq(examAnswerAssets.id, id),
          eq(examAnswerAssets.userId, context.user.id),
        ),
      );
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "附件删除失败" },
      { status: 500 },
    );
  }
}
