"use client";

import type { Question } from "../question-bank";
import {
  emptyExamAnswer,
  hasExamAnswer,
  type ExamAnswer,
  type ExamDraft,
} from "../exam-model";
import { SubjectiveAnswerTools } from "./SubjectiveAnswerTools";

type Props = {
  exam: ExamDraft;
  bank: Question[];
  account: boolean;
  formatClock: (seconds: number) => string;
  onChange: (next: ExamDraft) => void;
  onAnswer: (questionId: number, next: ExamAnswer) => void;
  onPause: () => void;
  onSubmit: () => void;
};

function ObjectiveAnswer({
  question,
  answer,
  onAnswer,
}: {
  question: Question;
  answer: ExamAnswer;
  onAnswer: (next: ExamAnswer) => void;
}) {
  if (question.options)
    return (
      <div className="options-list compact-options">
        {question.options.map((option, index) => {
          const letter = String.fromCharCode(65 + index);
          return (
            <button
              key={letter}
              className={answer.text === letter ? "selected" : ""}
              onClick={() => onAnswer({ ...answer, text: letter })}
            >
              <span>{letter}</span>
              {option}
            </button>
          );
        })}
      </div>
    );
  return (
    <label className="answer-input paper-text-answer">
      你的答案
      <input
        value={answer.text}
        onChange={(event) => onAnswer({ ...answer, text: event.target.value })}
      />
    </label>
  );
}

function ExamQuestion({
  exam,
  question,
  number,
  account,
  onAnswer,
}: {
  exam: ExamDraft;
  question: Question;
  number: number;
  account: boolean;
  onAnswer: (next: ExamAnswer) => void;
}) {
  const answer = exam.answers[question.id] ?? emptyExamAnswer();
  return (
    <article
      id={`exam-question-${question.id}`}
      className="paper-question"
      data-question-type={question.type}
    >
      <div className="paper-question-head">
        <strong>{number}.</strong>
        <span>{question.type}</span>
        <em>{question.points}分</em>
      </div>
      <h3>{question.prompt}</h3>
      {question.scoring === "rubric" ? (
        <SubjectiveAnswerTools
          examId={exam.id}
          question={question}
          answer={answer}
          account={account}
          phase="active"
          onChange={onAnswer}
        />
      ) : (
        <ObjectiveAnswer
          question={question}
          answer={answer}
          onAnswer={onAnswer}
        />
      )}
    </article>
  );
}

export function ExamActiveWorkspace({
  exam,
  bank,
  account,
  formatClock,
  onChange,
  onAnswer,
  onPause,
  onSubmit,
}: Props) {
  const byId = new Map(bank.map((question) => [question.id, question]));
  const pages = Array.from(
    new Set(exam.paperLayout.map((slot) => slot.page)),
  ).sort((a, b) => a - b);
  const currentQuestion = byId.get(exam.questionIds[exam.currentIndex]);
  function goTo(index: number) {
    const safe = Math.max(0, Math.min(exam.questionIds.length - 1, index));
    onChange({ ...exam, currentIndex: safe });
    if (exam.viewMode === "paper")
      requestAnimationFrame(() =>
        document
          .getElementById(`exam-question-${exam.questionIds[safe]}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
  }
  return (
    <div className="exam-workspace paper-exam-workspace">
      <aside className="exam-side paper-exam-side">
        <div
          className={`exam-timer ${exam.remainingSeconds <= 300 ? "urgent" : ""}`}
          aria-live="polite"
        >
          <span>剩余时间</span>
          <strong>{formatClock(exam.remainingSeconds)}</strong>
        </div>
        <div
          className="exam-view-toggle"
          role="group"
          aria-label="试卷显示模式"
        >
          <button
            className={exam.viewMode === "paper" ? "active" : ""}
            onClick={() => onChange({ ...exam, viewMode: "paper" })}
          >
            整卷
          </button>
          <button
            className={exam.viewMode === "focus" ? "active" : ""}
            onClick={() => onChange({ ...exam, viewMode: "focus" })}
          >
            专注
          </button>
        </div>
        <div className="paper-status">
          <span>
            第 {exam.currentIndex + 1} / {exam.questionIds.length} 题
          </span>
          <b>
            未答{" "}
            {
              exam.questionIds.filter((id) => !hasExamAnswer(exam.answers[id]))
                .length
            }
          </b>
        </div>
        <div className="answer-sheet" aria-label="答题卡">
          {exam.questionIds.map((id, index) => (
            <button
              key={id}
              className={`${index === exam.currentIndex ? "current " : ""}${hasExamAnswer(exam.answers[id]) ? "answered" : ""}`}
              onClick={() => goTo(index)}
              aria-label={`第${index + 1}题，${hasExamAnswer(exam.answers[id]) ? "已答" : "未答"}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <button className="secondary-button pause-button" onClick={onPause}>
          暂存并退出
        </button>
        <button className="primary-button paper-submit" onClick={onSubmit}>
          交卷
        </button>
      </aside>
      {exam.viewMode === "paper" ? (
        <div className="paper-pages" aria-label="整卷答题区">
          {pages.map((page) => (
            <section
              key={page}
              className="paper-page"
              aria-label={`第${page}页`}
            >
              <header>
                <span>849 微机原理及应用 · 模拟卷</span>
                <strong>
                  第 {page} 页 / 共 {pages.length} 页
                </strong>
              </header>
              <div className="paper-columns">
                {([1, 2] as const).map((column) => (
                  <div key={column} className="paper-column">
                    {exam.paperLayout
                      .filter(
                        (slot) => slot.page === page && slot.column === column,
                      )
                      .map((slot) => {
                        const question = byId.get(slot.questionId);
                        if (!question) return null;
                        return (
                          <ExamQuestion
                            key={slot.questionId}
                            exam={exam}
                            question={question}
                            number={slot.order + 1}
                            account={account}
                            onAnswer={(next) => {
                              onChange({ ...exam, currentIndex: slot.order });
                              onAnswer(question.id, next);
                            }}
                          />
                        );
                      })}
                  </div>
                ))}
              </div>
              <footer>
                本页题目位置已固定 · 刷新、暂存及跨设备恢复不会改变
              </footer>
            </section>
          ))}
        </div>
      ) : currentQuestion ? (
        <article className="question-card focus-exam-card">
          <div className="exam-progress">
            <span
              style={{
                width: `${((exam.currentIndex + 1) / exam.questionIds.length) * 100}%`,
              }}
            />
          </div>
          <div className="question-meta">
            <span>
              第{exam.currentIndex + 1}/{exam.questionIds.length}题
            </span>
            <b>{currentQuestion.chapter}</b>
            <b>{currentQuestion.section}</b>
            <small>{currentQuestion.points}分</small>
          </div>
          <h2>{currentQuestion.prompt}</h2>
          {currentQuestion.scoring === "rubric" ? (
            <SubjectiveAnswerTools
              examId={exam.id}
              question={currentQuestion}
              answer={exam.answers[currentQuestion.id] ?? emptyExamAnswer()}
              account={account}
              phase="active"
              onChange={(next) => onAnswer(currentQuestion.id, next)}
            />
          ) : (
            <ObjectiveAnswer
              question={currentQuestion}
              answer={exam.answers[currentQuestion.id] ?? emptyExamAnswer()}
              onAnswer={(next) => onAnswer(currentQuestion.id, next)}
            />
          )}
          <div className="question-footer">
            <button
              onClick={() => goTo(exam.currentIndex - 1)}
              disabled={exam.currentIndex === 0}
            >
              ← 上一题
            </button>
            <span className="exam-note">考试中不显示答案与解析</span>
            {exam.currentIndex < exam.questionIds.length - 1 ? (
              <button
                className="next-button"
                onClick={() => goTo(exam.currentIndex + 1)}
              >
                下一题 →
              </button>
            ) : (
              <button className="next-button" onClick={onSubmit}>
                交卷
              </button>
            )}
          </div>
        </article>
      ) : null}
    </div>
  );
}
