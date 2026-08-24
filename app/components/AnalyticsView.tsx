"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildAnalytics,
  type AnalyticsEvent,
  type ExamLike,
  type ProgressLike,
} from "../analytics";
import { questions } from "../question-bank";

type Props = {
  account: boolean;
  localEvents: AnalyticsEvent[];
  localProgress: ProgressLike[];
  localExams: ExamLike[];
  dueReviews: number;
  todayKey: string;
};

export function AnalyticsView({
  account,
  localEvents,
  localProgress,
  localExams,
  dueReviews,
  todayKey,
}: Props) {
  const [days, setDays] = useState(30);
  const [source, setSource] = useState("all");
  const [remote, setRemote] = useState<{
    events: AnalyticsEvent[];
    progress: ProgressLike[];
    exams: ExamLike[];
  } | null>(null);
  const [loading, setLoading] = useState(account);

  useEffect(() => {
    if (!account) return;
    queueMicrotask(() => setLoading(true));
    fetch("/api/analytics?days=70", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("load failed");
        return response.json() as Promise<{
          events?: AnalyticsEvent[];
          progress?: ProgressLike[];
          exams?: ExamLike[];
        }>;
      })
      .then((data) =>
        setRemote({
          events: data.events ?? [],
          progress: data.progress ?? [],
          exams: data.exams ?? [],
        }),
      )
      .catch(() => setRemote(null))
      .finally(() => setLoading(false));
  }, [account]);

  const analytics = useMemo(
    () =>
      buildAnalytics({
        questions,
        events: remote?.events ?? localEvents,
        progress: remote?.progress ?? localProgress,
        exams: remote?.exams ?? localExams,
        days,
        todayKey,
        source,
      }),
    [days, source, todayKey, remote, localEvents, localProgress, localExams],
  );
  const maxDaily = Math.max(
    1,
    ...analytics.daily.map((item) => item.correct + item.wrong),
  );
  const weakest = analytics.chapters
    .filter((item) => item.sampleEnough)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 4);
  const sourceProgress = remote?.progress ?? localProgress;
  const dueItems = sourceProgress
    .filter(
      (item) =>
        item.status === "mistake" &&
        (!item.nextReviewAt ||
          item.nextReviewAt <= `${todayKey}T23:59:59+08:00`),
    )
    .slice(0, 6)
    .map((item) =>
      questions.find((question) => question.id === item.questionId),
    )
    .filter((question): question is (typeof questions)[number] =>
      Boolean(question),
    );
  const hasConfirmedHistory = Boolean(
    remote?.events.some((event) => event.source === "legacy-backfill"),
  );

  return (
    <section className="analytics-view">
      <div className="practice-header">
        <div>
          <span className="eyebrow">
            <i /> PERSONAL LEARNING DATA
          </span>
          <h1>学习数据</h1>
          <p>正确率、得分率和覆盖率分开计算，并始终显示样本量。</p>
        </div>
        <div className="question-count">
          <strong>{analytics.totalAttempts}</strong>
          <span>区间作答</span>
        </div>
      </div>
      <div className="analytics-filters" aria-label="数据筛选">
        <div role="group" aria-label="时间范围">
          {[7, 30, 70].map((value) => (
            <button
              key={value}
              className={days === value ? "active" : ""}
              onClick={() => setDays(value)}
            >
              {value}天
            </button>
          ))}
        </div>
        <label>
          来源
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="all">全部</option>
            <option value="practice">章节练习</option>
            <option value="exam">组卷考试</option>
            <option value="review">错题复测</option>
          </select>
        </label>
        <span>
          {loading
            ? "同步数据中…"
            : account
              ? hasConfirmedHistory
                ? "账户历史 · 旧记录标为可确认历史"
                : "账户完整历史"
              : "本机数据 · 完整趋势从本次升级开始"}
        </span>
      </div>
      <div className="analytics-kpis">
        <article>
          <small>总作答量</small>
          <strong>
            {analytics.totalAttempts}
            <em>次</em>
          </strong>
          <p>按当前筛选范围</p>
        </article>
        <article>
          <small>客观题正确率</small>
          <strong>{analytics.objectiveAccuracy}%</strong>
          <p>{analytics.objectiveSamples} 次客观作答</p>
        </article>
        <article>
          <small>主观题得分率</small>
          <strong>{analytics.subjectiveRate}%</strong>
          <p>{analytics.subjectiveSamples} 次完成自评</p>
        </article>
        <article>
          <small>连续学习</small>
          <strong>
            {analytics.streak}
            <em>天</em>
          </strong>
          <p>按上海时区统计</p>
        </article>
        <article>
          <small>待复测</small>
          <strong>
            {dueReviews}
            <em>题</em>
          </strong>
          <p>已进入间隔复测</p>
        </article>
      </div>
      <div className="analytics-grid">
        <article className="data-card daily-card">
          <div className="section-heading">
            <div>
              <span>DAILY ACCURACY</span>
              <h2>每日客观作答</h2>
            </div>
            <b>蓝色正确 · 橙色错误</b>
          </div>
          <div className="daily-bars" aria-label={`${days}天每日正确错误分布`}>
            {analytics.daily.map((item) => (
              <button
                key={item.date}
                className="daily-bar"
                title={`${item.date}：正确${item.correct}，错误${item.wrong}`}
                aria-label={`${item.date}，正确${item.correct}次，错误${item.wrong}次`}
              >
                <span
                  className="daily-correct"
                  style={{ height: `${(item.correct / maxDaily) * 100}%` }}
                />
                <span
                  className="daily-wrong"
                  style={{ height: `${(item.wrong / maxDaily) * 100}%` }}
                />
              </button>
            ))}
          </div>
          <div className="chart-axis">
            <span>{analytics.daily[0]?.date.slice(5)}</span>
            <span>{todayKey.slice(5)}</span>
          </div>
        </article>
        <article className="data-card">
          <div className="section-heading">
            <div>
              <span>WEAK SPOTS</span>
              <h2>需要优先补强</h2>
            </div>
          </div>
          {weakest.length ? (
            <ol className="weak-list">
              {weakest.map((item, index) => (
                <li key={item.key}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <div>
                    <strong>{item.key}</strong>
                    <span>
                      正确率 {item.accuracy}% · {item.attempts}次
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-inline">累计至少5次作答后生成可靠排序。</div>
          )}
        </article>
        <article className="data-card chapter-card">
          <div className="section-heading">
            <div>
              <span>SPACED REVIEW</span>
              <h2>待复测题目</h2>
            </div>
            <b>{dueReviews}题</b>
          </div>
          {dueItems.length ? (
            <ol className="weak-list">
              {dueItems.map((question) => (
                <li key={question.id}>
                  <b>↻</b>
                  <div>
                    <strong>
                      #{question.id} {question.section}
                    </strong>
                    <span>
                      {question.chapter} · {question.keypoint}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-inline">当前没有到期复测题目。</div>
          )}
        </article>
        <article className="data-card chapter-card">
          <div className="section-heading">
            <div>
              <span>CHAPTER DIAGNOSIS</span>
              <h2>章节表现与覆盖</h2>
            </div>
          </div>
          <div className="metric-bars">
            {analytics.chapters.map((item) => (
              <div key={item.key}>
                <div>
                  <strong>{item.key}</strong>
                  <span>
                    {item.accuracy}% · {item.attempts}次 · 覆盖{item.coverage}%
                  </span>
                </div>
                <i>
                  <b style={{ width: `${item.accuracy}%` }} />
                  <em style={{ left: `${item.coverage}%` }} />
                </i>
                {!item.sampleEnough && item.attempts > 0 ? (
                  <small>样本较少，暂不参与薄弱排名</small>
                ) : null}
              </div>
            ))}
          </div>
        </article>
        <article className="data-card">
          <div className="section-heading">
            <div>
              <span>QUESTION TYPES</span>
              <h2>题型表现</h2>
            </div>
          </div>
          <div className="type-performance">
            {analytics.types.map((item) => (
              <div key={item.key}>
                <span>{item.key}</span>
                <strong>{item.accuracy}%</strong>
                <i>
                  <b style={{ width: `${item.accuracy}%` }} />
                </i>
                <small>
                  {item.attempts}次 · 覆盖{item.coverage}%
                </small>
              </div>
            ))}
          </div>
        </article>
        <article className="data-card exam-trend">
          <div className="section-heading">
            <div>
              <span>EXAM TREND</span>
              <h2>最近十次考试</h2>
            </div>
          </div>
          {analytics.exams.length ? (
            <div className="exam-bars">
              {analytics.exams.map((item) => (
                <div
                  key={item.id}
                  title={`${Math.round((item.score / item.total) * 100)}%，用时${Math.round(item.durationSeconds / 60)}分钟`}
                >
                  <i
                    style={{
                      height: `${Math.round((item.score / item.total) * 100)}%`,
                    }}
                  />
                  <b>{Math.round((item.score / item.total) * 100)}%</b>
                  <small>{Math.round(item.durationSeconds / 60)}分</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-inline">完成第一套组卷后显示趋势。</div>
          )}
        </article>
      </div>
    </section>
  );
}
