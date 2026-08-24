"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Image from "next/image";
import type { Question } from "../question-bank";
import {
  clearAiVault,
  readAiVaultHint,
  saveAiVault,
  unlockAiVault,
  type AiVaultConfig,
} from "../ai-vault";
import {
  emptyExamAnswer,
  type ExamAnswer,
  type ExamAssetRef,
  type HandwritingPage,
  type InkStroke,
} from "../exam-model";
import {
  deletePhotoDraft,
  readInkDraft,
  readPhotoDraft,
  saveInkDraft,
  savePhotoDraft,
} from "../ink-storage";

type Props = {
  examId: string;
  question: Question;
  answer?: ExamAnswer;
  account: boolean;
  phase: "active" | "review";
  disabled?: boolean;
  onChange: (answer: ExamAnswer) => void;
};
type Tool = "pen" | "highlighter" | "eraser";

function drawPage(canvas: HTMLCanvasElement, page: HandwritingPage) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (page.background === "grid") {
    context.strokeStyle = "#dce8ee";
    context.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 32) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 0; y < canvas.height; y += 32) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }
  }
  for (const stroke of page.strokes) {
    if (stroke.points.length < 2) continue;
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = stroke.color;
    context.globalAlpha = stroke.tool === "highlighter" ? 0.28 : 1;
    for (let index = 1; index < stroke.points.length; index += 1) {
      const previous = stroke.points[index - 1];
      const point = stroke.points[index];
      context.lineWidth = stroke.width * Math.max(0.45, point.pressure || 0.5);
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(point.x, point.y);
      context.stroke();
    }
    context.restore();
  }
}

function pageImage(page: HandwritingPage) {
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 620;
  drawPage(canvas, page);
  return canvas.toDataURL("image/jpeg", 0.86);
}
function fileToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function normalizeImage(file: Blob, rotation = 0, cropPercent = 0) {
  const source = await createImageBitmap(file);
  const cropX = Math.round((source.width * cropPercent) / 100);
  const cropY = Math.round((source.height * cropPercent) / 100);
  const sourceWidth = source.width - cropX * 2;
  const sourceHeight = source.height - cropY * 2;
  const scale = Math.min(1, 2200 / Math.max(sourceWidth, sourceHeight));
  const turn = ((rotation % 360) + 360) % 360;
  const swapped = turn === 90 || turn === 270;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(
    1,
    Math.round((swapped ? sourceHeight : sourceWidth) * scale),
  );
  canvas.height = Math.max(
    1,
    Math.round((swapped ? sourceWidth : sourceHeight) * scale),
  );
  const context = canvas.getContext("2d")!;
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((turn * Math.PI) / 180);
  context.drawImage(
    source,
    cropX,
    cropY,
    sourceWidth,
    sourceHeight,
    (-sourceWidth * scale) / 2,
    (-sourceHeight * scale) / 2,
    sourceWidth * scale,
    sourceHeight * scale,
  );
  source.close();
  let quality = 0.88;
  let blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((value) => resolve(value!), "image/jpeg", quality),
  );
  while (blob.size > 1_500_000 && quality > 0.48) {
    quality -= 0.1;
    blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), "image/jpeg", quality),
    );
  }
  if (blob.size > 1_500_000)
    throw new Error("图片压缩后仍超过1.5MB，请先裁小后上传");
  return blob;
}

export function SubjectiveAnswerTools({
  examId,
  question,
  answer = emptyExamAnswer(),
  account,
  phase,
  disabled,
  onChange,
}: Props) {
  const [tab, setTab] = useState<"text" | "ink" | "photo">("text");
  const [pageIndex, setPageIndex] = useState(0);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#152026");
  const [width, setWidth] = useState(7);
  const [penOnly, setPenOnly] = useState(true);
  const [redo, setRedo] = useState<InkStroke[][]>([]);
  const [message, setMessage] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStroke = useRef<InkStroke | null>(null);
  const inkUploadTimer = useRef<number | null>(null);
  const answerRef = useRef(answer);
  const hydratedAssets = useRef(new Set<string>());
  const [aiOpen, setAiOpen] = useState(false);
  const [vaultHint, setVaultHint] = useState<{
    provider: AiVaultConfig["provider"];
    model: string;
  } | null>(null);
  const [provider, setProvider] = useState<AiVaultConfig["provider"]>("qwen");
  const [model, setModel] = useState("qwen3-vl-plus");
  const [apiKey, setApiKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [unlocked, setUnlocked] = useState<AiVaultConfig | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [initialPageId] = useState(() => crypto.randomUUID());
  const pages = answer.handwriting.length
    ? answer.handwriting
    : [{ id: initialPageId, background: "grid" as const, strokes: [] }];
  const page = pages[Math.min(pageIndex, pages.length - 1)];
  useEffect(() => {
    if (canvasRef.current) drawPage(canvasRef.current, page);
  }, [page]);
  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);
  useEffect(() => {
    if (answer.handwriting.length) return;
    readInkDraft(examId, question.id)
      .then((stored) => {
        if (stored?.length)
          onChange({ ...answerRef.current, handwriting: stored });
      })
      .catch(() => {});
  }, [examId, question.id, answer.handwriting.length, onChange]);
  useEffect(() => {
    const localAssets = answer.assets.filter(
      (asset) =>
        !asset.remote &&
        asset.kind === "photo" &&
        !hydratedAssets.current.has(asset.id),
    );
    if (!localAssets.length) return;
    localAssets.forEach((asset) => hydratedAssets.current.add(asset.id));
    Promise.all(
      localAssets.map(async (asset) => {
        const blob = await readPhotoDraft(asset.id);
        return blob
          ? { id: asset.id, previewUrl: URL.createObjectURL(blob) }
          : null;
      }),
    )
      .then((hydrated) => {
        const urls = new Map(
          hydrated
            .filter((item): item is { id: string; previewUrl: string } =>
              Boolean(item),
            )
            .map((item) => [item.id, item.previewUrl]),
        );
        if (urls.size)
          onChange({
            ...answerRef.current,
            assets: answerRef.current.assets.map((asset) =>
              urls.has(asset.id)
                ? { ...asset, previewUrl: urls.get(asset.id) }
                : asset,
            ),
          });
      })
      .catch(() => {});
  }, [answer.assets, onChange]);
  useEffect(
    () => () => {
      if (inkUploadTimer.current) window.clearTimeout(inkUploadTimer.current);
    },
    [],
  );
  useEffect(() => {
    readAiVaultHint()
      .then((hint) => {
        setVaultHint(hint);
        if (hint) {
          setProvider(hint.provider);
          setModel(hint.model);
        }
      })
      .catch(() => {});
  }, []);
  function update(patch: Partial<ExamAnswer>) {
    onChange({ ...answer, ...patch });
  }
  function setPages(next: HandwritingPage[]) {
    update({ handwriting: next });
    saveInkDraft(examId, question.id, next).catch(() => {});
    if (account) {
      if (inkUploadTimer.current) window.clearTimeout(inkUploadTimer.current);
      inkUploadTimer.current = window.setTimeout(async () => {
        try {
          const current = answerRef.current;
          const uploaded = await uploadRemote(
            new Blob([JSON.stringify(next)], { type: "application/json" }),
            `handwriting-${question.id}.json`,
            "canvas",
          );
          onChange({
            ...current,
            handwriting: next,
            assets: [
              ...current.assets.filter((asset) => asset.kind !== "canvas"),
              uploaded,
            ],
          });
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "笔迹云端同步失败，本机草稿仍已保存",
          );
        }
      }, 900);
    }
  }
  function point(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1000,
      y: ((event.clientY - rect.top) / rect.height) * 620,
      pressure: event.pressure || 0.5,
    };
  }
  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled || (penOnly && event.pointerType !== "pen")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = point(event);
    if (tool === "eraser") {
      const next = page.strokes.filter(
        (stroke) =>
          !stroke.points.some(
            (item) =>
              Math.hypot(item.x - p.x, item.y - p.y) < Math.max(18, width * 3),
          ),
      );
      setPages(
        pages.map((item, index) =>
          index === pageIndex ? { ...item, strokes: next } : item,
        ),
      );
      return;
    }
    activeStroke.current = {
      id: crypto.randomUUID(),
      tool,
      color,
      width,
      points: [p],
    };
  }
  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!activeStroke.current) return;
    activeStroke.current.points.push(point(event));
    drawPage(event.currentTarget, {
      ...page,
      strokes: [...page.strokes, activeStroke.current],
    });
  }
  function pointerUp() {
    if (!activeStroke.current) return;
    const stroke = activeStroke.current;
    activeStroke.current = null;
    setPages(
      pages.map((item, index) =>
        index === pageIndex
          ? { ...item, strokes: [...item.strokes, stroke] }
          : item,
      ),
    );
    setRedo([]);
  }
  function undo() {
    if (!page.strokes.length) return;
    setRedo((items) => [...items, [page.strokes.at(-1)!]]);
    setPages(
      pages.map((item, index) =>
        index === pageIndex
          ? { ...item, strokes: item.strokes.slice(0, -1) }
          : item,
      ),
    );
  }
  function redoStroke() {
    const strokes = redo.at(-1);
    if (!strokes) return;
    setPages(
      pages.map((item, index) =>
        index === pageIndex
          ? { ...item, strokes: [...item.strokes, ...strokes] }
          : item,
      ),
    );
    setRedo((items) => items.slice(0, -1));
  }
  async function uploadRemote(
    blob: Blob,
    name: string,
    kind: "photo" | "canvas" = "photo",
  ) {
    const form = new FormData();
    form.set("examId", examId);
    form.set("questionId", String(question.id));
    form.set("kind", kind);
    form.set("file", new File([blob], name, { type: blob.type }));
    const response = await fetch("/api/exam-assets", {
      method: "POST",
      body: form,
    });
    const data = (await response.json()) as {
      error?: string;
      asset?: ExamAssetRef;
    };
    if (!response.ok) throw new Error(data.error || "上传失败");
    if (!data.asset) throw new Error("上传响应缺少附件信息");
    return data.asset;
  }
  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const next = [...answer.assets];
    for (const file of Array.from(files)) {
      if (next.filter((asset) => asset.kind === "photo").length >= 6) {
        setMessage("每题最多6张图片");
        break;
      }
      try {
        const blob = await normalizeImage(file);
        const local: ExamAssetRef = {
          id: crypto.randomUUID(),
          kind: "photo",
          name: file.name.replace(/\.[^.]+$/, ".jpg"),
          mimeType: "image/jpeg",
          previewUrl: URL.createObjectURL(blob),
        };
        let asset = local;
        if (account) {
          try {
            asset = await uploadRemote(blob, local.name);
          } catch (error) {
            setMessage((error as Error).message + "，已保存在本机草稿");
          }
        }
        if (!asset.remote) await savePhotoDraft(asset.id, blob);
        next.push(asset);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "图片处理失败");
      }
    }
    update({ assets: next });
  }
  async function transformAsset(
    asset: ExamAssetRef,
    rotation: number,
    crop: number,
  ) {
    try {
      const response = await fetch(
        asset.previewUrl ||
          `/api/exam-assets?id=${encodeURIComponent(asset.id)}`,
      );
      const blob = await normalizeImage(await response.blob(), rotation, crop);
      let replacement: ExamAssetRef = {
        id: crypto.randomUUID(),
        kind: "photo",
        name: asset.name,
        mimeType: "image/jpeg",
        previewUrl: URL.createObjectURL(blob),
      };
      if (account) {
        replacement = await uploadRemote(blob, asset.name);
        if (asset.remote)
          fetch(`/api/exam-assets?id=${encodeURIComponent(asset.id)}`, {
            method: "DELETE",
          }).catch(() => {});
      }
      if (!replacement.remote) await savePhotoDraft(replacement.id, blob);
      if (!asset.remote) await deletePhotoDraft(asset.id);
      update({
        assets: answer.assets.map((item) =>
          item.id === asset.id ? replacement : item,
        ),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "图片编辑失败");
    }
  }
  async function removeAsset(asset: ExamAssetRef) {
    if (asset.remote)
      fetch(`/api/exam-assets?id=${encodeURIComponent(asset.id)}`, {
        method: "DELETE",
      }).catch(() => {});
    else await deletePhotoDraft(asset.id).catch(() => {});
    update({ assets: answer.assets.filter((item) => item.id !== asset.id) });
  }
  function moveAsset(asset: ExamAssetRef, direction: -1 | 1) {
    const photos = answer.assets.filter((item) => item.kind === "photo");
    const index = photos.findIndex((item) => item.id === asset.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= photos.length) return;
    [photos[index], photos[target]] = [photos[target], photos[index]];
    update({
      assets: [
        ...photos,
        ...answer.assets.filter((item) => item.kind !== "photo"),
      ],
    });
  }
  async function saveVault() {
    try {
      await saveAiVault({ provider, model, apiKey }, passphrase);
      setUnlocked({ provider, model, apiKey });
      setApiKey("");
      setVaultHint({ provider, model });
      setMessage("AI配置已加密保存在本机");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  async function unlockVault() {
    try {
      const config = await unlockAiVault(passphrase);
      setUnlocked(config);
      setProvider(config.provider);
      setModel(config.model);
      setMessage("AI密钥库已解锁");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  async function runAi() {
    if (!account) {
      setMessage("请先登录后使用AI识别");
      return;
    }
    if (!unlocked) {
      setMessage("请先解锁或保存AI配置");
      return;
    }
    setAiBusy(true);
    try {
      const images = [
        ...pages.filter((item) => item.strokes.length).map(pageImage),
      ];
      for (const asset of answer.assets.filter(
        (item) => item.kind === "photo",
      )) {
        const response = await fetch(
          asset.previewUrl ||
            `/api/exam-assets?id=${encodeURIComponent(asset.id)}`,
        );
        images.push(await fileToDataUrl(await response.blob()));
      }
      const response = await fetch("/api/ai-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: unlocked.provider,
          model: unlocked.model,
          token: unlocked.apiKey,
          examId,
          questionId: question.id,
          phase,
          images: unlocked.provider === "deepseek" ? [] : images,
          transcript: answer.text,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        analysis?: ExamAnswer["analysis"];
      };
      if (!response.ok) throw new Error(data.error || "识别失败");
      if (!data.analysis) throw new Error("识别响应格式无效");
      update({ analysis: data.analysis });
      setMessage("AI辅助结果已生成，请自行核对");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "识别失败");
    } finally {
      setAiBusy(false);
    }
  }
  return (
    <div className="subjective-tools">
      <div className="answer-tabs" role="tablist" aria-label="主观题答题方式">
        {(
          [
            ["text", "键盘"],
            ["ink", "手写"],
            ["photo", "图片"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "photo" &&
            answer.assets.some((asset) => asset.kind === "photo")
              ? ` ${answer.assets.filter((asset) => asset.kind === "photo").length}`
              : ""}
          </button>
        ))}
        <button className="ai-tab" onClick={() => setAiOpen(!aiOpen)}>
          AI辅助
        </button>
      </div>
      {tab === "text" && (
        <textarea
          rows={8}
          value={answer.text}
          onChange={(event) => update({ text: event.target.value })}
          placeholder="可输入答案，也可使用手写或上传答题纸"
          disabled={disabled}
        />
      )}
      {tab === "ink" && (
        <div className="ink-workspace">
          <div className="ink-toolbar">
            <select
              value={tool}
              onChange={(event) => setTool(event.target.value as Tool)}
              disabled={disabled}
            >
              <option value="pen">画笔</option>
              <option value="highlighter">高亮</option>
              <option value="eraser">橡皮</option>
            </select>
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              aria-label="画笔颜色"
              disabled={disabled}
            />
            <label>
              笔宽
              <input
                type="range"
                min="2"
                max="24"
                value={width}
                onChange={(event) => setWidth(Number(event.target.value))}
                disabled={disabled}
              />
            </label>
            <button onClick={undo} disabled={disabled || !page.strokes.length}>
              撤销
            </button>
            <button onClick={redoStroke} disabled={disabled || !redo.length}>
              重做
            </button>
            <label>
              <input
                type="checkbox"
                checked={penOnly}
                onChange={(event) => setPenOnly(event.target.checked)}
              />
              仅触控笔
            </label>
          </div>
          <canvas
            ref={canvasRef}
            width="1000"
            height="620"
            className={`ink-canvas ${page.background}`}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
          />
          <div className="ink-pages">
            <button
              onClick={() =>
                setPages(
                  pages.map((item, index) =>
                    index === pageIndex
                      ? {
                          ...item,
                          background:
                            item.background === "grid" ? "blank" : "grid",
                        }
                      : item,
                  ),
                )
              }
              disabled={disabled}
            >
              切换纸张
            </button>
            {pages.map((item, index) => (
              <button
                key={item.id}
                className={index === pageIndex ? "active" : ""}
                onClick={() => setPageIndex(index)}
              >
                第{index + 1}页
              </button>
            ))}
            <button
              onClick={() => {
                if (pages.length < 6) {
                  const next = [
                    ...pages,
                    {
                      id: crypto.randomUUID(),
                      background: "grid" as const,
                      strokes: [],
                    },
                  ];
                  setPages(next);
                  setPageIndex(next.length - 1);
                }
              }}
              disabled={disabled || pages.length >= 6}
            >
              ＋加页
            </button>
          </div>
        </div>
      )}
      {tab === "photo" && (
        <div className="photo-answer">
          <label className="upload-tile">
            ＋ 拍照或选择图片
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={(event) => addPhotos(event.target.files)}
              disabled={disabled}
            />
            <small>自动压缩，单题最多6张</small>
          </label>
          <div className="photo-grid">
            {answer.assets
              .filter((asset) => asset.kind === "photo")
              .map((asset, index, list) => (
                <article key={asset.id}>
                  <Image
                    src={
                      asset.previewUrl ||
                      `/api/exam-assets?id=${encodeURIComponent(asset.id)}`
                    }
                    alt={asset.name}
                    width={640}
                    height={420}
                    unoptimized
                  />
                  <div>
                    <button
                      onClick={() => moveAsset(asset, -1)}
                      disabled={disabled || index === 0}
                    >
                      前移
                    </button>
                    <button
                      onClick={() => moveAsset(asset, 1)}
                      disabled={disabled || index === list.length - 1}
                    >
                      后移
                    </button>
                    <button
                      onClick={() => transformAsset(asset, 90, 0)}
                      disabled={disabled}
                    >
                      旋转
                    </button>
                    <button
                      onClick={() => transformAsset(asset, 0, 5)}
                      disabled={disabled}
                    >
                      裁切
                    </button>
                    <button
                      onClick={() => removeAsset(asset)}
                      disabled={disabled}
                    >
                      删除
                    </button>
                  </div>
                </article>
              ))}
          </div>
        </div>
      )}
      {aiOpen && (
        <section className="ai-panel">
          <div className="ai-head">
            <div>
              <strong>用户自备AI</strong>
              <small>Token不会进入账户、试卷或服务器数据库</small>
            </div>
            <span>
              {unlocked
                ? "本次会话已解锁"
                : vaultHint
                  ? "设备中已有加密配置"
                  : "尚未配置"}
            </span>
          </div>
          <div className="ai-config">
            <label>
              平台
              <select
                value={provider}
                onChange={(event) => {
                  const value = event.target.value as AiVaultConfig["provider"];
                  setProvider(value);
                  setModel(
                    value === "qwen"
                      ? "qwen3-vl-plus"
                      : value === "openai"
                        ? "gpt-5.4"
                        : "deepseek-v4-flash",
                  );
                }}
              >
                <option value="qwen">千问视觉</option>
                <option value="openai">OpenAI</option>
                <option value="deepseek">DeepSeek文字复核</option>
              </select>
            </label>
            <label>
              模型
              <input
                value={model}
                onChange={(event) => setModel(event.target.value)}
              />
            </label>
            {!vaultHint && (
              <label>
                API Token
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  autoComplete="off"
                />
              </label>
            )}
            <label>
              本机解锁口令
              <input
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                autoComplete="off"
              />
            </label>
          </div>
          <div className="ai-actions">
            {vaultHint ? (
              <button onClick={unlockVault}>解锁密钥库</button>
            ) : (
              <button
                onClick={saveVault}
                disabled={!apiKey || passphrase.length < 8}
              >
                加密保存并解锁
              </button>
            )}
            <button
              className="primary-button"
              onClick={runAi}
              disabled={!unlocked || aiBusy}
            >
              {aiBusy
                ? "识别中…"
                : phase === "active"
                  ? "仅转写笔迹"
                  : "识别并建议评分点"}
            </button>
            {vaultHint && (
              <button
                onClick={() =>
                  clearAiVault().then(() => {
                    setVaultHint(null);
                    setUnlocked(null);
                    setMessage("已清除本机AI配置");
                  })
                }
              >
                清除配置
              </button>
            )}
          </div>
          {answer.analysis && (
            <div className="ai-result">
              <strong>AI辅助结果 · 请人工核对</strong>
              <p>{answer.analysis.transcript || "未识别出可靠文字"}</p>
              {answer.analysis.suggestedRubricIds.length > 0 && (
                <p>
                  <b>疑似命中评分点：</b>
                  {answer.analysis.suggestedRubricIds.join("、")}
                  （仍需你在量规中逐项确认）
                </p>
              )}
              {answer.analysis.warnings.map((warning) => (
                <small key={warning}>⚠ {warning}</small>
              ))}
              <button
                onClick={() => update({ text: answer.analysis!.transcript })}
                disabled={disabled}
              >
                填入文字答题框
              </button>
            </div>
          )}
        </section>
      )}
      {message && (
        <p className="answer-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
