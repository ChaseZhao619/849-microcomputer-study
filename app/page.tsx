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
  { name: "微型计算机基础", code: "01", sections: ["数制与编码", "补码运算", "系统组成", "总线基础"], source: "第一章讲义 · 有效周练", target: 18, progress: 0 },
  { name: "8086 CPU结构", code: "02", sections: ["BIU 与 EU", "寄存器组", "存储器分段", "引脚与工作模式", "总线时序"], source: "第二章讲义 · 第7–15周练习", target: 24, progress: 0 },
  { name: "寻址与指令系统", code: "03", sections: ["寻址方式", "数据传送指令", "算术与逻辑指令", "串操作指令", "控制转移指令"], source: "第三章讲义 · 指令简表 · 周练", target: 28, progress: 0 },
  { name: "汇编语言程序设计", code: "04", sections: ["伪指令与段定义", "DOS 功能调用", "分支与循环", "子程序与堆栈", "程序分析"], source: "第四章讲义 · 编程题总结课", target: 14, progress: 0 },
  { name: "存储器系统", code: "05", sections: ["RAM 与 ROM", "地址译码", "容量与位扩展", "系统连接", "Cache 基础"], source: "第五章讲义 · 习题讲解", target: 18, progress: 0 },
  { name: "I/O接口技术", code: "06", sections: ["I/O 编址", "程序查询", "中断传送", "DMA", "接口设计"], source: "第六章讲义 · 习题讲解", target: 13, progress: 0 },
  { name: "8255A并行接口", code: "07", sections: ["三种工作方式", "方式控制字", "端口地址", "初始化编程"], source: "第六章讲义 · 编程题总结课", target: 18, progress: 0 },
  { name: "中断系统与8259A", code: "08", sections: ["中断向量", "中断响应流程", "8259A 结构", "级联", "ICW 与 OCW"], source: "第八章作业 · 有效周练", target: 18, progress: 0 },
  { name: "8253/8254定时器", code: "09", sections: ["六种工作方式", "计数初值", "控制字", "初始化编程", "应用设计"], source: "第七章讲义 · 编程题总结课", target: 18, progress: 0 },
  { name: "串行通信与8251A", code: "10", sections: ["同步与异步", "波特率与帧格式", "控制字", "初始化编程"], source: "第九章讲义 · 章节作业", target: 13, progress: 0 },
  { name: "A/D与D/A转换", code: "11", sections: ["采样量化编码", "DAC0832", "ADC0809", "接口编程", "波形生成"], source: "第十章讲义 · 章节作业", target: 18, progress: 0 },
];

const questions: Question[] = [
  {
    id: 849001, chapter: "微型计算机基础", section: "数制与编码", type: "选择题", difficulty: "基础",
    prompt: "十进制数 85 转换为十六进制数，正确的是（ ）。", options: ["45H", "55H", "65H", "5AH"], answer: "B",
    explanation: "85 ÷ 16 = 5 余 5，因此高位和低位均为 5，结果为 55H。也可以用 5×16+5=85 反向验证。",
    keypoint: "十进制与十六进制互换",
  },
  {
    id: 849002, chapter: "8086 CPU结构", section: "存储器分段", type: "计算题", difficulty: "基础",
    prompt: "8086 中 CS=2A10H、IP=0100H，求下一条指令所在单元的物理地址。", answer: "2A200H", accepted: ["2A200", "2A200H"],
    explanation: "物理地址=段基址×10H+偏移地址。2A10H×10H=2A100H，再加 0100H，得到 2A200H。",
    keypoint: "物理地址=段地址×16+偏移地址",
  },
  {
    id: 849003, chapter: "8086 CPU结构", section: "BIU 与 EU", type: "选择题", difficulty: "基础",
    prompt: "8086 中负责取指令、形成物理地址并完成总线操作的部件是（ ）。", options: ["EU", "ALU", "BIU", "CU"], answer: "C",
    explanation: "总线接口单元 BIU 负责取指令、地址形成和总线控制；执行单元 EU 负责译码与执行。二者并行工作形成简单流水。",
    keypoint: "BIU 与 EU 的分工",
  },
  {
    id: 849004, chapter: "寻址与指令系统", section: "寻址方式", type: "选择题", difficulty: "强化",
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
    id: 849006, chapter: "中断系统与8259A", section: "中断向量", type: "填空题", difficulty: "强化",
    prompt: "8086 中断类型码为 N，则其中断向量在中断向量表中的首地址为 ______。", answer: "4N", accepted: ["4N", "N*4", "N×4"],
    explanation: "每个中断向量占 4 个字节，依次存放 IP 低/高字节和 CS 低/高字节，因此 N 号中断向量首地址为 4N。",
    keypoint: "中断向量表位于 00000H～003FFH",
  },
  {
    id: 849007, chapter: "中断系统与8259A", section: "级联", type: "选择题", difficulty: "强化",
    prompt: "1 片主 8259A 与 8 片从 8259A 级联，最多可管理的可屏蔽中断源数为（ ）。", options: ["8", "16", "56", "64"], answer: "D",
    explanation: "每片从片提供 8 级中断，8 片从片共提供 64 级。主片的 8 条 IR 线用于连接从片。",
    keypoint: "8259A 级联结构",
  },
  {
    id: 849008, chapter: "8253/8254定时器", section: "计数初值", type: "计算题", difficulty: "强化",
    prompt: "8253 的 CLK 输入频率为 1 MHz，若需产生 1 kHz 的周期信号，计数初值应为多少？", answer: "1000（03E8H）", accepted: ["1000", "03E8H", "3E8H"],
    explanation: "分频计数初值 N=fCLK/fOUT=1,000,000/1,000=1000，换算为十六进制是 03E8H。",
    keypoint: "定时/计数器分频计算",
  },
  {
    id: 849009, chapter: "I/O接口技术", section: "I/O 编址", type: "选择题", difficulty: "基础",
    prompt: "在 I/O 端口独立编址方式下，8086 访问端口主要使用（ ）。", options: ["MOV 指令", "IN/OUT 指令", "LEA 指令", "PUSH/POP 指令"], answer: "B",
    explanation: "I/O 独立编址拥有独立端口空间，CPU 使用专门的 IN 和 OUT 指令访问；存储器映射 I/O 才可使用普通访存指令。",
    keypoint: "I/O 独立编址与统一编址",
  },
  {
    id: 849010, chapter: "8255A并行接口", section: "方式控制字", type: "选择题", difficulty: "综合",
    prompt: "8255A 工作方式控制字中，最高位 D7 应设置为（ ）。", options: ["0", "1", "由端口 A 决定", "由读写信号决定"], answer: "B",
    explanation: "D7=1 表示方式选择控制字；D7=0 表示对端口 C 的某一位进行置位/复位操作（BSR）。这是两类控制字的判别位。",
    keypoint: "8255A 两类控制字",
  },
  {
    id: 849011, chapter: "微型计算机基础", section: "补码运算", type: "填空题", difficulty: "基础",
    prompt: "8 位有符号数 −18 的补码为 ______（十六进制表示）。", answer: "EEH", accepted: ["EE", "EEH"],
    explanation: "+18=12H，按位取反得到 EDH，再加 1 得 EEH。8 位补码的最高位为符号位。",
    keypoint: "负数补码=对应正数按位取反后加1",
  },
  {
    id: 849012, chapter: "寻址与指令系统", section: "算术与逻辑指令", type: "选择题", difficulty: "强化",
    prompt: "执行 XOR AX,AX 后，AX 的值和进位标志 CF 分别为（ ）。", options: ["0000H、0", "0000H、1", "FFFFH、0", "保持不变、0"], answer: "A",
    explanation: "同一操作数异或结果为 0；XOR 指令会把 CF 和 OF 清零。",
    keypoint: "逻辑运算指令对标志位的影响",
  },
  {
    id: 849013, chapter: "汇编语言程序设计", section: "分支与循环", type: "计算题", difficulty: "强化",
    prompt: "若 CX 初值为 5，循环体末尾执行 LOOP AGAIN，则循环体共执行多少次？", answer: "5次", accepted: ["5", "5次"],
    explanation: "LOOP 先将 CX 减 1，再在 CX≠0 时转移。CX 从 5 递减到 0，因此循环体执行 5 次。",
    keypoint: "LOOP 指令与 CX 计数",
  },
  {
    id: 849014, chapter: "汇编语言程序设计", section: "DOS 功能调用", type: "填空题", difficulty: "基础",
    prompt: "使用 DOS 21H 中断的 02H 功能显示一个字符时，待显示字符应放入 ______ 寄存器。", answer: "DL", accepted: ["DL", "dl"],
    explanation: "调用前令 AH=02H，DL=字符的 ASCII 码，再执行 INT 21H。",
    keypoint: "INT 21H 的字符输出功能",
  },
  {
    id: 849015, chapter: "存储器系统", section: "地址译码", type: "计算题", difficulty: "综合",
    prompt: "某 8K×8 位存储器的首地址为 20000H，若连续编址，其末地址是多少？", answer: "21FFFH", accepted: ["21FFF", "21FFFH"],
    explanation: "8K=2000H 个地址单元，末地址=20000H+2000H−1=21FFFH。",
    keypoint: "存储器地址范围=首地址+容量−1",
  },
  {
    id: 849016, chapter: "I/O接口技术", section: "DMA", type: "选择题", difficulty: "基础",
    prompt: "大量数据在外设与存储器之间高速传送，且希望尽量减少 CPU 介入，应优先采用（ ）。", options: ["无条件传送", "程序查询", "中断传送", "DMA 传送"], answer: "D",
    explanation: "DMA 控制器取得总线控制权后，可在外设与存储器之间直接传送数据，CPU 只负责初始化与结束处理。",
    keypoint: "四种 I/O 数据传送方式的适用场景",
  },
  {
    id: 849017, chapter: "8255A并行接口", section: "端口地址", type: "计算题", difficulty: "强化",
    prompt: "8255A 的 A 口地址为 280H，若 A1A0 依次选择 A口、B口、C口和控制口，则控制口地址为多少？", answer: "283H", accepted: ["283", "283H"],
    explanation: "四个内部端口连续编址，控制口对应 A1A0=11，因此地址为 280H+3=283H。",
    keypoint: "8255A 内部端口地址分配",
  },
  {
    id: 849018, chapter: "中断系统与8259A", section: "中断响应流程", type: "选择题", difficulty: "强化",
    prompt: "8086 响应可屏蔽中断请求的必要条件之一是（ ）。", options: ["TF=1", "IF=1", "CF=1", "DF=1"], answer: "B",
    explanation: "可屏蔽中断 INTR 只有在 IF=1 且当前指令执行结束后才可能被响应。",
    keypoint: "中断允许标志 IF",
  },
  {
    id: 849019, chapter: "8253/8254定时器", section: "六种工作方式", type: "选择题", difficulty: "强化",
    prompt: "8253/8254 需要连续输出对称方波时，通常选择工作方式（ ）。", options: ["方式0", "方式1", "方式2", "方式3"], answer: "D",
    explanation: "方式3是方波发生器，适合产生连续周期方波；方式2通常用于分频率发生器。",
    keypoint: "8253/8254 各工作方式特征",
  },
  {
    id: 849020, chapter: "串行通信与8251A", section: "波特率与帧格式", type: "计算题", difficulty: "强化",
    prompt: "异步传送采用 1 个起始位、8 个数据位、1 个停止位且无校验。传送 1000 个字符共需发送多少位？", answer: "10000位", accepted: ["10000", "10000位"],
    explanation: "每个字符共 1+8+1=10 位，1000 个字符需发送 1000×10=10000 位。",
    keypoint: "异步串行帧的传输效率",
  },
  {
    id: 849021, chapter: "串行通信与8251A", section: "初始化编程", type: "选择题", difficulty: "综合",
    prompt: "8251A 初始化时，在方式指令之后通常应写入（ ）。", options: ["中断向量", "命令指令", "DMA 页地址", "8255A 控制字"], answer: "B",
    explanation: "8251A 复位后先写方式指令配置同步/异步和帧格式，再写命令指令启用收发等功能。",
    keypoint: "8251A 初始化顺序",
  },
  {
    id: 849022, chapter: "A/D与D/A转换", section: "采样量化编码", type: "计算题", difficulty: "基础",
    prompt: "8 位 A/D 转换器的输入范围为 0～5V，其理论分辨率约为多少？", answer: "19.53mV", accepted: ["19.53MV", "19.5MV", "5/256V"],
    explanation: "分辨率=满量程/2^n=5V/256≈0.01953V=19.53mV。",
    keypoint: "A/D 转换分辨率",
  },
  {
    id: 849023, chapter: "A/D与D/A转换", section: "DAC0832", type: "选择题", difficulty: "强化",
    prompt: "DAC0832 采用双缓冲方式的主要目的是（ ）。", options: ["提高输入阻抗", "让多路 D/A 同步更新", "直接输出电压", "省去参考电源"], answer: "B",
    explanation: "双缓冲可先分别装入各通道数据，再统一更新 D/A 寄存器，适合多路同步输出。",
    keypoint: "DAC0832 的单缓冲与双缓冲",
  },
];

const plannedQuestionCount = chapterGroups.reduce((total, chapter) => total + chapter.target, 0);
const topicCount = chapterGroups.reduce((total, chapter) => total + chapter.sections.length, 0);

const navItems = [
  { id: "home", label: "学习首页", icon: "⌂" },
  { id: "practice", label: "章节刷题", icon: "◎" },
  { id: "mastery", label: "题库目录", icon: "◫" },
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
  const accuracy = Object.keys(progress).length ? Math.round((mastered / Object.keys(progress).length) * 100) : 0;
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

  const heat = Array.from({ length: 70 }, (_, index) => index === 69 ? Math.min(4, Object.keys(progress).length) : 0);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`} aria-label="学习导航">
        <div className="brand"><div className="brand-mark" aria-hidden="true"><span>8</span><span>49</span></div><div><strong>微机研习社</strong><small>849 STUDY LAB</small></div></div>
        <nav className="main-nav" aria-label="主要功能">
          <p className="nav-title">学习工作台</p>
          {navItems.map((item) => <button key={item.id} className={view === item.id ? "nav-active" : ""} onClick={() => switchView(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}{item.id === "mistakes" && <em>{mistakes}</em>}</button>)}
        </nav>
        <div className="chapter-nav"><p className="nav-title">知识树 · 11章</p>{chapterGroups.map((chapter) => { const online = questions.filter((question) => question.chapter === chapter.name).length; return <button key={chapter.name} onClick={() => beginChapter(chapter.name)}><span>{chapter.code}</span><div><strong>{chapter.name}</strong><small>{chapter.sections.length} 专题 · {online}/{chapter.target} 题</small></div><i style={{ "--p": `${chapter.progress}%` } as React.CSSProperties} /></button>; })}</div>
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
              <div className="hero-copy"><span className="eyebrow"><i /> 2027 考研 · 上海理工大学</span><h1>把 849 的每一个<br /><em>失分点</em>，练成得分点。</h1><p>依据考试大纲、章节讲义与有效周练拆解知识点；第三方资料只用于考点提炼，公开题目均重新命制。</p><div className="hero-actions"><button className="primary-button" onClick={() => beginChapter("8086 CPU结构")}>开始章节训练 <span>→</span></button><button className="secondary-button" onClick={() => switchView("mastery")}>查看题库目录</button></div><div className="hero-meta"><span>✓ 11 章完整知识树</span><span>✓ {questions.length} 道首批改写题</span><span>✓ 进度保存在本机</span></div></div>
              <div className="countdown-card"><div className="circuit-corner" /><span>距离预计初试</span><strong>{daysLeft}</strong><b>DAYS</b><p>目标：完成 3 轮知识闭环</p><div className="countdown-track"><i /></div><small>当前阶段 · 基础强化</small></div>
            </section>
            <section className="stats-grid" aria-label="学习概览">
              <article><span className="stat-icon cyan">∿</span><div><small>本机已练</small><strong>{Object.keys(progress).length}<em>题</em></strong><p>首批上线 {questions.length} 题</p></div></article>
              <article><span className="stat-icon amber">◎</span><div><small>当前正确率</small><strong>{accuracy}<em>%</em></strong><p>按本机作答实时计算</p></div></article>
              <article><span className="stat-icon violet">◇</span><div><small>已掌握题目</small><strong>{mastered}<em>/ {questions.length}</em></strong><p>{topicCount} 个专题待逐步覆盖</p></div></article>
              <article><span className="stat-icon red">↻</span><div><small>待复测错题</small><strong>{mistakes}<em>题</em></strong><button onClick={() => switchView("mistakes")}>开始复测 →</button></div></article>
            </section>
            <section className="source-strip" aria-label="题库建设说明"><div><span>资料清理结果</span><h2>从 112 项课程资料中提炼有效考点</h2><p>已排除空文件、宣传页、重复图片与非 849 内容；答案文件仅作校核，不直接公开。</p></div><dl><div><dt>11</dt><dd>一级章节</dd></div><div><dt>{topicCount}</dt><dd>二级专题</dd></div><div><dt>{plannedQuestionCount}</dt><dd>规划题量</dd></div><div><dt>{questions.length}</dt><dd>首批上线</dd></div></dl></section>
            <section className="dashboard-grid">
              <article className="study-card"><div className="section-heading"><div><span>今日任务</span><h2>继续你的学习计划</h2></div><button onClick={() => switchView("practice")}>全部任务</button></div><div className="task-list">
                <button onClick={() => beginChapter("寻址与指令系统")}><span className="task-number">01</span><div><b>寻址方式 · 强化训练</b><small>寻址与指令系统 · 2 题已上线</small></div><em><i style={{ width: "0%" }} />未开始</em><strong>开始 →</strong></button>
                <button onClick={() => beginChapter("存储器系统")}><span className="task-number">02</span><div><b>存储器地址与容量扩展</b><small>存储器系统 · 2 题已上线</small></div><em><i style={{ width: "0%" }} />未开始</em><strong>开始 →</strong></button>
                <button onClick={() => beginChapter("中断系统与8259A")}><span className="task-number">03</span><div><b>中断向量与响应过程</b><small>中断系统与8259A · 3 题已上线</small></div><em><i style={{ width: "0%" }} />未开始</em><strong>开始 →</strong></button>
              </div></article>
              <article className="activity-card"><div className="section-heading"><div><span>学习节奏</span><h2>近 10 周活跃度</h2></div><b>{Object.keys(progress).length ? "今日已启动" : "等待首次作答"}</b></div><div className="heat-wrap"><div className="heat-labels"><span>一</span><span>三</span><span>五</span><span>日</span></div><div className="heatmap" aria-label="近十周学习热力图">{heat.map((level, index) => <i key={index} data-level={level} title={`第 ${index + 1} 天，强度 ${level}`} />)}</div></div><div className="heat-footer"><span>本机累计完成 <b>{Object.keys(progress).length}</b> 次作答标记</span><span>少 <i data-level="1" /><i data-level="2" /><i data-level="3" /><i data-level="4" /> 多</span></div></article>
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
            <div className="practice-header"><div><span className="eyebrow"><i /> COURSE CATALOG</span><h1>849 题库目录</h1><p>依据课程资料重组为 11 章、{topicCount} 个专题；已上线题目可直接进入练习。</p></div><div className="mastery-score"><strong>{mastered}</strong><span>已掌握 / {questions.length}</span></div></div>
            <div className="mastery-grid">{chapterGroups.map((chapter) => { const chapterQuestions = questions.filter((question) => question.chapter === chapter.name); const chapterMastered = chapterQuestions.filter((question) => progress[question.id] === "mastered").length; const chapterProgress = chapterQuestions.length ? Math.round((chapterMastered / chapterQuestions.length) * 100) : 0; return <article key={chapter.name}><div className="mastery-top"><span>{chapter.code}</span><div><h2>{chapter.name}</h2><p>{chapter.source}</p></div><strong>{chapterProgress}%</strong></div><div className="catalog-count"><span>{chapter.sections.length} 个专题</span><span>{chapterQuestions.length} 道已上线 / {chapter.target} 道规划</span></div><div className="mastery-progress"><i style={{ width: `${chapterProgress}%` }} /></div><ul>{chapter.sections.map((section) => { const online = chapterQuestions.some((question) => question.section === section); return <li key={section}><button onClick={() => beginChapter(chapter.name)}><span className={online ? "good" : "new"} />{section}<em>{online ? "可练" : "建设中"}</em></button></li>; })}</ul></article>; })}</div>
            <div className="legend"><span><i className="good" />已掌握</span><span><i className="weak" />需强化</span><span><i className="new" />未开始</span><small>掌握度来自本机作答记录，正式版可接入账户同步。</small></div>
          </section>}
        </main>
        <footer><span>849 微机研习社 · 结构化刷题平台</span><span>依据考试大纲与课程资料提炼 · 第三方材料不原样公开</span></footer>
      </div>
      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="关闭导航" />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
