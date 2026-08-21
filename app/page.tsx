"use client";

import { useEffect, useMemo, useState } from "react";

type Question = {
  id: number;
  chapter: string;
  section: string;
  type: "选择题" | "填空题" | "计算题";
  difficulty: "基础" | "强化" | "综合";
  prompt: string;
  options?: string[];
  answer: string;
  accepted?: string[];
  explanation: string;
  keypoint: string;
};

const chapterGroups = [
  { name: "微机系统基础", code: "01", sections: ["数制与编码", "系统组成", "总线与时序"], progress: 72 },
  { name: "8086 处理器", code: "02", sections: ["内部结构", "寄存器", "存储器分段", "寻址方式"], progress: 58 },
  { name: "指令与汇编", code: "03", sections: ["指令系统", "程序结构", "子程序", "DOS 功能调用"], progress: 36 },
  { name: "存储器系统", code: "04", sections: ["存储器芯片", "地址译码", "容量扩展", "系统连接"], progress: 41 },
  { name: "输入输出与中断", code: "05", sections: ["I/O 接口", "中断系统", "DMA", "8259A"], progress: 24 },
  { name: "可编程接口", code: "06", sections: ["8255A", "8253/8254", "串行通信", "A/D 与 D/A"], progress: 15 },
];

const questions: Question[] = [
  {
    id: 849001, chapter: "微机系统基础", section: "数制与编码", type: "选择题", difficulty: "基础",
    prompt: "十进制数 85 转换为十六进制数，正确的是（ ）。", options: ["45H", "55H", "65H", "5AH"], answer: "B",
    explanation: "85 ÷ 16 = 5 余 5，因此高位和低位均为 5，结果为 55H。也可以用 5×16+5=85 反向验证。",
    keypoint: "十进制与十六进制互换",
  },
  {
    id: 849002, chapter: "8086 处理器", section: "存储器分段", type: "计算题", difficulty: "基础",
    prompt: "8086 中 CS=2A10H、IP=0100H，求下一条指令所在单元的物理地址。", answer: "2A200H", accepted: ["2A200", "2A200H"],
    explanation: "物理地址=段基址×10H+偏移地址。2A10H×10H=2A100H，再加 0100H，得到 2A200H。",
    keypoint: "物理地址=段地址×16+偏移地址",
  },
  {
    id: 849003, chapter: "8086 处理器", section: "内部结构", type: "选择题", difficulty: "基础",
    prompt: "8086 中负责取指令、形成物理地址并完成总线操作的部件是（ ）。", options: ["EU", "ALU", "BIU", "CU"], answer: "C",
    explanation: "总线接口单元 BIU 负责取指令、地址形成和总线控制；执行单元 EU 负责译码与执行。二者并行工作形成简单流水。",
    keypoint: "BIU 与 EU 的分工",
  },
  {
    id: 849004, chapter: "8086 处理器", section: "寻址方式", type: "选择题", difficulty: "强化",
    prompt: "指令 MOV AX,[BX+SI+08H] 的源操作数采用（ ）。", options: ["寄存器间接寻址", "基址寻址", "基址变址寻址", "相对基址变址寻址"], answer: "D",
    explanation: "有效地址由基址寄存器 BX、变址寄存器 SI 和位移量 08H 三部分构成，因此属于相对基址变址寻址。",
    keypoint: "有效地址 EA 的组成",
  },
  {
    id: 849005, chapter: "存储器系统", section: "容量扩展", type: "计算题", difficulty: "强化",
    prompt: "用 8K×8 位存储器芯片组成 32K×16 位存储器，需要多少片芯片？", answer: "8片", accepted: ["8", "8片"],
    explanation: "字数扩展倍数为 32K/8K=4，位数扩展倍数为 16/8=2，共需 4×2=8 片。先位扩展、后字扩展更容易画出连接图。",
    keypoint: "芯片数=字扩展倍数×位扩展倍数",
  },
  {
    id: 849006, chapter: "输入输出与中断", section: "中断系统", type: "填空题", difficulty: "强化",
    prompt: "8086 中断类型码为 N，则其中断向量在中断向量表中的首地址为 ______。", answer: "4N", accepted: ["4N", "N*4", "N×4"],
    explanation: "每个中断向量占 4 个字节，依次存放 IP 低/高字节和 CS 低/高字节，因此 N 号中断向量首地址为 4N。",
    keypoint: "中断向量表位于 00000H～003FFH",
  },
  {
    id: 849007, chapter: "输入输出与中断", section: "8259A", type: "选择题", difficulty: "强化",
    prompt: "1 片主 8259A 与 8 片从 8259A 级联，最多可管理的可屏蔽中断源数为（ ）。", options: ["8", "16", "56", "64"], answer: "D",
    explanation: "每片从片提供 8 级中断，8 片从片共提供 64 级。主片的 8 条 IR 线用于连接从片。",
    keypoint: "8259A 级联结构",
  },
  {
    id: 849008, chapter: "可编程接口", section: "8253/8254", type: "计算题", difficulty: "强化",
    prompt: "8253 的 CLK 输入频率为 1 MHz，若需产生 1 kHz 的周期信号，计数初值应为多少？", answer: "1000（03E8H）", accepted: ["1000", "03E8H", "3E8H"],
    explanation: "分频计数初值 N=fCLK/fOUT=1,000,000/1,000=1000，换算为十六进制是 03E8H。",
    keypoint: "定时/计数器分频计算",
  },
  {
    id: 849009, chapter: "输入输出与中断", section: "I/O 接口", type: "选择题", difficulty: "基础",
    prompt: "在 I/O 端口独立编址方式下，8086 访问端口主要使用（ ）。", options: ["MOV 指令", "IN/OUT 指令", "LEA 指令", "PUSH/POP 指令"], answer: "B",
    explanation: "I/O 独立编址拥有独立端口空间，CPU 使用专门的 IN 和 OUT 指令访问；存储器映射 I/O 才可使用普通访存指令。",
    keypoint: "I/O 独立编址与统一编址",
  },
  {
    id: 849010, chapter: "可编程接口", section: "8255A", type: "选择题", difficulty: "综合",
    prompt: "8255A 工作方式控制字中，最高位 D7 应设置为（ ）。", options: ["0", "1", "由端口 A 决定", "由读写信号决定"], answer: "B",
    explanation: "D7=1 表示方式选择控制字；D7=0 表示对端口 C 的某一位进行置位/复位操作（BSR）。这是两类控制字的判别位。",
    keypoint: "8255A 两类控制字",
  },
];

const navItems = [
  { id: "home", label: "学习首页", icon: "⌂" },
  { id: "practice", label: "章节刷题", icon: "◎" },
  { id: "mastery", label: "掌握地图", icon: "◫" },
  { id: "mistakes", label: "错题复测", icon: "↻" },
] as const;

type View = (typeof navItems)[number]["id"];
type StoredProgress = Record<number, "mastered" | "unsure" | "mistake">;

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState("全部章节");
  const [difficulty, setDifficulty] = useState("全部难度");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [progress, setProgress] = useState<StoredProgress>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("micro849-progress");
    const savedTheme = localStorage.getItem("micro849-theme");
    if (saved) setProgress(JSON.parse(saved));
    if (savedTheme === "dark") setDark(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("micro849-theme", dark ? "dark" : "light");
  }, [dark]);

  const filteredQuestions = useMemo(
    () => questions.filter((question) =>
      (view !== "mistakes" || progress[question.id] === "mistake") &&
      (selectedChapter === "全部章节" || question.chapter === selectedChapter) &&
      (difficulty === "全部难度" || question.difficulty === difficulty)),
    [selectedChapter, difficulty, view, progress],
  );
  const currentQuestion = filteredQuestions[questionIndex] ?? filteredQuestions[0];
  const mastered = Object.values(progress).filter((value) => value === "mastered").length;
  const mistakes = Object.values(progress).filter((value) => value === "mistake").length;
  const accuracy = Object.keys(progress).length ? Math.round((mastered / Object.keys(progress).length) * 100) : 68;
  const daysLeft = Math.max(0, Math.ceil((new Date("2026-12-19T08:30:00+08:00").getTime() - Date.now()) / 86400000));
  const answerCorrect = currentQuestion
    ? [currentQuestion.answer, ...(currentQuestion.accepted ?? [])].some(
        (answer) => answer.replace(/\s/g, "").toUpperCase() === selectedAnswer.replace(/\s/g, "").toUpperCase(),
      )
    : false;

  function switchView(next: View) {
    setView(next);
    setSidebarOpen(false);
    if (next === "mistakes") { setSelectedChapter("全部章节"); setDifficulty("全部难度"); }
  }

  function beginChapter(chapter: string) {
    setSelectedChapter(chapter); setDifficulty("全部难度"); setQuestionIndex(0); setSelectedAnswer(""); setRevealed(false); switchView("practice");
  }

  function markQuestion(status: StoredProgress[number]) {
    if (!currentQuestion) return;
    const next = { ...progress, [currentQuestion.id]: status };
    setProgress(next); localStorage.setItem("micro849-progress", JSON.stringify(next));
    setNotice(status === "mastered" ? "已加入掌握记录" : status === "mistake" ? "已加入错题复测" : "已标记为模糊");
    window.setTimeout(() => setNotice(""), 1800);
  }

  function nextQuestion() {
    if (!filteredQuestions.length) return;
    setQuestionIndex((index) => (index + 1) % filteredQuestions.length); setSelectedAnswer(""); setRevealed(false);
  }

  const heat = Array.from({ length: 70 }, (_, index) => index > 57 ? 0 : (index * 7 + 3) % 5);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`} aria-label="学习导航">
        <div className="brand"><div className="brand-mark" aria-hidden="true"><span>8</span><span>49</span></div><div><strong>微机研习社</strong><small>849 STUDY LAB</small></div></div>
        <nav className="main-nav" aria-label="主要功能">
          <p className="nav-title">学习工作台</p>
          {navItems.map((item) => <button key={item.id} className={view === item.id ? "nav-active" : ""} onClick={() => switchView(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}{item.id === "mistakes" && <em>{mistakes}</em>}</button>)}
        </nav>
        <div className="chapter-nav"><p className="nav-title">知识树</p>{chapterGroups.map((chapter) => <button key={chapter.name} onClick={() => beginChapter(chapter.name)}><span>{chapter.code}</span><div><strong>{chapter.name}</strong><small>{chapter.sections.length} 个专题</small></div><i style={{ "--p": `${chapter.progress}%` } as React.CSSProperties} /></button>)}</div>
        <div className="book-card"><span>参考教材</span><strong>《微型计算机原理与接口技术》</strong><small>周荷琴、冯焕清等 · 第6版</small></div>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="打开学习导航">☰</button>
          <div className="breadcrumb"><span>849 微机原理及应用</span><b>/</b><strong>{navItems.find((item) => item.id === view)?.label}</strong></div>
          <div className="top-actions"><button className="search-button" onClick={() => { setView("practice"); setNotice("已进入题库，可按章节筛选"); }}>⌕ <span>搜索题目</span><kbd>⌘ K</kbd></button><button className="icon-button" onClick={() => setDark(!dark)} aria-label="切换深色模式">{dark ? "☀" : "☾"}</button><div className="avatar" title="本机学习档案">J</div></div>
        </header>

        <main>
          {view === "home" && <>
            <section className="hero-panel">
              <div className="hero-copy"><span className="eyebrow"><i /> 2027 考研 · 上海理工大学</span><h1>把 849 的每一个<br /><em>失分点</em>，练成得分点。</h1><p>按大纲拆解知识点，用原创题目训练计算、汇编与接口设计。错题自动沉淀，薄弱章节一眼可见。</p><div className="hero-actions"><button className="primary-button" onClick={() => beginChapter("8086 处理器")}>继续今日训练 <span>→</span></button><button className="secondary-button" onClick={() => switchView("mastery")}>查看掌握地图</button></div><div className="hero-meta"><span>✓ 无需登录即可试用</span><span>✓ 进度保存在本机</span><span>✓ 示例题均为原创</span></div></div>
              <div className="countdown-card"><div className="circuit-corner" /><span>距离预计初试</span><strong>{daysLeft}</strong><b>DAYS</b><p>目标：完成 3 轮知识闭环</p><div className="countdown-track"><i /></div><small>当前阶段 · 基础强化</small></div>
            </section>
            <section className="stats-grid" aria-label="学习概览">
              <article><span className="stat-icon cyan">∿</span><div><small>今日已练</small><strong>{Object.keys(progress).length || 12}<em>题</em></strong><p>目标 30 题</p></div></article>
              <article><span className="stat-icon amber">◎</span><div><small>当前正确率</small><strong>{accuracy}<em>%</em></strong><p>较上周 +6%</p></div></article>
              <article><span className="stat-icon violet">◇</span><div><small>已掌握知识点</small><strong>{mastered || 18}<em>/ 96</em></strong><p>本周新增 4 个</p></div></article>
              <article><span className="stat-icon red">↻</span><div><small>待复测错题</small><strong>{mistakes || 7}<em>题</em></strong><button onClick={() => switchView("mistakes")}>开始复测 →</button></div></article>
            </section>
            <section className="dashboard-grid">
              <article className="study-card"><div className="section-heading"><div><span>今日任务</span><h2>继续你的学习计划</h2></div><button onClick={() => switchView("practice")}>全部任务</button></div><div className="task-list">
                <button onClick={() => beginChapter("8086 处理器")}><span className="task-number">01</span><div><b>寻址方式 · 强化训练</b><small>8086 处理器 · 12 题</small></div><em><i style={{ width: "58%" }} />58%</em><strong>继续 →</strong></button>
                <button onClick={() => beginChapter("存储器系统")}><span className="task-number">02</span><div><b>存储器容量扩展</b><small>存储器系统 · 8 题</small></div><em><i style={{ width: "25%" }} />25%</em><strong>继续 →</strong></button>
                <button onClick={() => beginChapter("输入输出与中断")}><span className="task-number">03</span><div><b>中断向量与响应过程</b><small>输入输出与中断 · 10 题</small></div><em><i style={{ width: "0%" }} />未开始</em><strong>开始 →</strong></button>
              </div></article>
              <article className="activity-card"><div className="section-heading"><div><span>学习节奏</span><h2>近 10 周活跃度</h2></div><b>连续 6 天</b></div><div className="heat-wrap"><div className="heat-labels"><span>一</span><span>三</span><span>五</span><span>日</span></div><div className="heatmap" aria-label="近十周学习热力图">{heat.map((level, index) => <i key={index} data-level={level} title={`第 ${index + 1} 天，强度 ${level}`} />)}</div></div><div className="heat-footer"><span>近 70 天完成 <b>486</b> 次作答</span><span>少 <i data-level="1" /><i data-level="2" /><i data-level="3" /><i data-level="4" /> 多</span></div></article>
            </section>
            <section className="roadmap-strip"><div><span>当前路线</span><h2>849 三轮复习进度</h2></div><ol><li className="done"><b>01</b><span><strong>基础通关</strong><small>概念 + 例题</small></span></li><li className="current"><b>02</b><span><strong>专题强化</strong><small>计算 + 汇编</small></span></li><li><b>03</b><span><strong>真题模拟</strong><small>套卷 + 复盘</small></span></li></ol></section>
          </>}

          {(view === "practice" || view === "mistakes") && <section className="practice-view">
            <div className="practice-header"><div><span className="eyebrow"><i /> 849 原创训练题库</span><h1>{view === "mistakes" ? "错题复测" : "章节刷题"}</h1><p>{view === "mistakes" ? "重新作答，连续两次正确后建议移出错题本。" : "先独立作答，再查看解析；用掌握状态驱动下一轮复习。"}</p></div><div className="question-count"><strong>{filteredQuestions.length}</strong><span>当前筛选题目</span></div></div>
            <div className="filter-bar"><label>章节<select value={selectedChapter} onChange={(event) => { setSelectedChapter(event.target.value); setQuestionIndex(0); setRevealed(false); }}><option>全部章节</option>{chapterGroups.map((chapter) => <option key={chapter.name}>{chapter.name}</option>)}</select></label><label>难度<select value={difficulty} onChange={(event) => { setDifficulty(event.target.value); setQuestionIndex(0); setRevealed(false); }}><option>全部难度</option><option>基础</option><option>强化</option><option>综合</option></select></label><span>第 {filteredQuestions.length ? questionIndex + 1 : 0} / {filteredQuestions.length} 题</span></div>
            {currentQuestion ? <article className="question-card">
              <div className="question-meta"><span>#{currentQuestion.id}</span><b>{currentQuestion.chapter}</b><b>{currentQuestion.section}</b><em data-difficulty={currentQuestion.difficulty}>{currentQuestion.difficulty}</em><small>{currentQuestion.type}</small></div>
              <h2>{currentQuestion.prompt}</h2>
              {currentQuestion.options ? <div className="options-list">{currentQuestion.options.map((option, index) => { const letter = String.fromCharCode(65 + index); const correct = revealed && letter === currentQuestion.answer; const wrong = revealed && selectedAnswer === letter && letter !== currentQuestion.answer; return <button key={letter} className={`${selectedAnswer === letter ? "selected" : ""} ${correct ? "correct" : ""} ${wrong ? "wrong" : ""}`} onClick={() => !revealed && setSelectedAnswer(letter)}><span>{letter}</span>{option}</button>; })}</div> : <label className="answer-input">你的答案<input value={selectedAnswer} onChange={(event) => setSelectedAnswer(event.target.value)} placeholder="先在草稿纸完成，再输入结果" disabled={revealed} /></label>}
              {!revealed ? <button className="primary-button submit-answer" onClick={() => { setRevealed(true); markQuestion(answerCorrect ? "mastered" : "mistake"); }} disabled={!selectedAnswer.trim()}>提交并查看解析</button> : <div className="analysis-panel"><div className="answer-result"><span>参考答案</span><strong>{currentQuestion.answer}</strong><em>{answerCorrect ? "回答正确" : "需要复测"}</em></div><div><span>解题解析</span><p>{currentQuestion.explanation}</p><small><b>核心考点：</b>{currentQuestion.keypoint}</small></div></div>}
              <div className="question-footer"><div><span>掌握状态</span><button onClick={() => markQuestion("mastered")}>✓ 已掌握</button><button onClick={() => markQuestion("unsure")}>? 有点模糊</button><button onClick={() => markQuestion("mistake")}>↻ 加入错题</button></div><button className="next-button" onClick={nextQuestion}>下一题 →</button></div>
            </article> : <div className="empty-state"><strong>当前筛选下没有题目</strong><p>换一个章节或难度继续练习。</p></div>}
          </section>}

          {view === "mastery" && <section className="mastery-view">
            <div className="practice-header"><div><span className="eyebrow"><i /> KNOWLEDGE MAP</span><h1>849 掌握地图</h1><p>从基础原理到综合接口设计，按章节定位薄弱点。</p></div><div className="mastery-score"><strong>{mastered || 18}</strong><span>已掌握 / 96</span></div></div>
            <div className="mastery-grid">{chapterGroups.map((chapter, index) => <article key={chapter.name}><div className="mastery-top"><span>{chapter.code}</span><div><h2>{chapter.name}</h2><p>{chapter.sections.length} 个专题 · {questions.filter((q) => q.chapter === chapter.name).length || 6} 道示例题</p></div><strong>{chapter.progress}%</strong></div><div className="mastery-progress"><i style={{ width: `${chapter.progress}%` }} /></div><ul>{chapter.sections.map((section, sectionIndex) => <li key={section}><button onClick={() => beginChapter(chapter.name)}><span className={(sectionIndex + index) % 3 === 0 ? "weak" : sectionIndex === 0 ? "good" : "new"} />{section}<em>{(sectionIndex * 13 + chapter.progress) % 8}/8</em></button></li>)}</ul></article>)}</div>
            <div className="legend"><span><i className="good" />已掌握</span><span><i className="weak" />需强化</span><span><i className="new" />未开始</span><small>掌握度来自本机作答记录，正式版可接入账户同步。</small></div>
          </section>}
        </main>
        <footer><span>849 微机研习社 · 个人备考原型</span><span>依据公开参考书目规划 · 题目为原创演示内容</span></footer>
      </div>
      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="关闭导航" />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
