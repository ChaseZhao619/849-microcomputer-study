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

const starterQuestions: Question[] = [
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
    id: 849005, chapter: "存储器系统", section: "容量与位扩展", type: "计算题", difficulty: "强化",
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

type ConceptSeed = {
  chapter: string;
  section: string;
  cue: string;
  correct: string;
  wrong: [string, string, string];
  explanation: string;
};

const conceptSeeds: ConceptSeed[] = [
  { chapter: "微型计算机基础", section: "数制与编码", cue: "十六进制与二进制的对应关系", correct: "1 位十六进制数恰好对应 4 位二进制数", wrong: ["1 位十六进制数对应 2 位二进制数", "十六进制不能直接转换为二进制", "十六进制只用于表示负数"], explanation: "十六进制的基数 16 等于 2 的 4 次方，因此每一位可无损对应 4 位二进制。" },
  { chapter: "微型计算机基础", section: "补码运算", cue: "8 位补码的数值范围", correct: "−128～+127", wrong: ["−127～+127", "−128～+128", "0～255"], explanation: "n 位补码的范围是 −2^(n−1)～2^(n−1)−1。" },
  { chapter: "微型计算机基础", section: "系统组成", cue: "微型计算机系统的基本组成", correct: "CPU、存储器、I/O 接口与系统总线共同构成硬件主体", wrong: ["只有 CPU 和显示器", "只有运算器和控制器", "软件可完全替代存储器"], explanation: "处理、存储、输入输出与互连是微机硬件系统的四类基本职能。" },
  { chapter: "微型计算机基础", section: "总线基础", cue: "地址总线宽度的意义", correct: "决定处理器可直接形成的地址数量", wrong: ["直接决定每条指令的执行时间", "只决定串口波特率", "与寻址空间无关"], explanation: "若有 n 根地址线，理论上可形成 2^n 个不同地址。" },

  { chapter: "8086 CPU结构", section: "BIU 与 EU", cue: "8086 中 BIU 与 EU 的并行工作", correct: "BIU 可预取指令，EU 同时译码和执行当前指令", wrong: ["EU 负责产生全部总线周期", "BIU 只进行算术运算", "二者任何时候都不能并行"], explanation: "指令队列让取指与执行在一定程度上重叠，提高了总线利用率。" },
  { chapter: "8086 CPU结构", section: "寄存器组", cue: "8086 堆栈操作的默认寄存器", correct: "栈顶由 SS:SP 指示", wrong: ["栈顶由 CS:IP 指示", "栈顶由 DS:SI 指示", "栈顶由 ES:DI 指示"], explanation: "8086 的堆栈段寄存器是 SS，栈顶偏移由 SP 保存。" },
  { chapter: "8086 CPU结构", section: "存储器分段", cue: "8086 物理地址的形成", correct: "段地址左移 4 位后与偏移地址相加", wrong: ["段地址与偏移地址按位异或", "段地址右移 4 位后相加", "只使用偏移地址"], explanation: "物理地址=段地址×10H+偏移地址，因此不同段:偏移组合可能指向同一单元。" },
  { chapter: "8086 CPU结构", section: "引脚与工作模式", cue: "8086 最小模式与最大模式", correct: "MN/MX# 引脚用于选择系统工作模式", wrong: ["由 RESET 脉宽选择模式", "由数据总线最低位选择模式", "两种模式的总线控制完全相同"], explanation: "最小模式适合单处理器系统，最大模式常与 8288 等配合用于多处理器结构。" },
  { chapter: "8086 CPU结构", section: "总线时序", cue: "ALE 信号的作用", correct: "在总线周期开始时锁存复用线上的地址信息", wrong: ["始终屏蔽中断请求", "直接给 DRAM 提供刷新", "决定 ALU 的运算类型"], explanation: "8086 的部分地址/数据线复用，需要 ALE 配合外部锁存器分离地址。" },

  { chapter: "寻址与指令系统", section: "寻址方式", cue: "BX+SI+位移量形成有效地址", correct: "属于相对基址变址寻址", wrong: ["立即寻址", "寄存器寻址", "直接端口寻址"], explanation: "有效地址同时含基址、变址和位移量，是相对基址变址形式。" },
  { chapter: "寻址与指令系统", section: "数据传送指令", cue: "MOV 指令的操作约束", correct: "一般不允许两个内存操作数之间直接传送", wrong: ["目的操作数必须是立即数", "MOV 必然改变 CF", "CS 可以用普通 MOV 直接装入"], explanation: "8086 大多数 MOV 形式至多含一个存储器操作数，立即数也不能作为目的操作数。" },
  { chapter: "寻址与指令系统", section: "算术与逻辑指令", cue: "CMP 指令的本质", correct: "执行减法以设置标志位，但不保存差值", wrong: ["执行加法并保存到目的操作数", "只清零 CF", "等价于无条件转移"], explanation: "CMP 常与条件转移配合，根据虚拟减法产生的标志位判断大小关系。" },
  { chapter: "寻址与指令系统", section: "串操作指令", cue: "REP MOVSB 的重复次数", correct: "由 CX 的初值决定", wrong: ["由 AX 的低 8 位决定", "固定为 256 次", "由 CF 决定"], explanation: "REP 前缀每次操作后使 CX 减 1，直到 CX 为 0。" },
  { chapter: "寻址与指令系统", section: "控制转移指令", cue: "JNE/JNZ 的转移条件", correct: "ZF=0 时发生转移", wrong: ["ZF=1 时发生转移", "CF=1 时无条件转移", "IF=0 时发生转移"], explanation: "JNE 与 JNZ 是同一机器条件：比较结果不等，即零标志为 0。" },

  { chapter: "汇编语言程序设计", section: "伪指令与段定义", cue: "DB、DW 与 DD 定义的数据宽度", correct: "分别定义字节、字和双字数据", wrong: ["分别定义 1、2、3 位数据", "都只定义字节", "只在运行时由 CPU 执行"], explanation: "它们是汇编阶段处理的伪指令，不是 CPU 运行时执行的机器指令。" },
  { chapter: "汇编语言程序设计", section: "DOS 功能调用", cue: "INT 21H 的 09H 功能", correct: "显示以 $ 结束的字符串", wrong: ["读取磁盘扇区", "关闭可屏蔽中断", "设置 8259A 优先级"], explanation: "调用前通常令 AH=09H，DS:DX 指向以 $ 结尾的字符串。" },
  { chapter: "汇编语言程序设计", section: "分支与循环", cue: "LOOP 指令的执行规则", correct: "先将 CX 减 1，若结果不为 0 则转移", wrong: ["先将 AX 加 1 再转移", "只根据 CF 判断", "每次把 CX 清零"], explanation: "LOOP 将计数和条件转移合并，适合已知循环次数的结构。" },
  { chapter: "汇编语言程序设计", section: "子程序与堆栈", cue: "CALL 与 RET 的配合", correct: "CALL 保存返回地址，RET 从堆栈恢复返回地址", wrong: ["CALL 自动保存全部通用寄存器", "RET 必然清空整个堆栈", "二者都不访问堆栈"], explanation: "近调用通常压入 IP，远调用还会压入 CS；RET 按对应形式恢复。" },
  { chapter: "汇编语言程序设计", section: "程序分析", cue: "分析汇编程序的可靠步骤", correct: "逐条跟踪寄存器、内存和标志位的变化", wrong: ["只看最后一条指令", "忽略数据段和堆栈", "默认所有标志位恒为 0"], explanation: "程序分析应建立执行轨迹，尤其关注分支条件、循环计数和隐含操作数。" },

  { chapter: "存储器系统", section: "RAM 与 ROM", cue: "SRAM 与 DRAM 的主要区别", correct: "DRAM 需要周期刷新，SRAM 通常不需要刷新", wrong: ["SRAM 只能读不能写", "DRAM 断电后仍永久保存", "二者都属于非易失存储器"], explanation: "DRAM 单元用电容存储电荷，结构密度高但需刷新；SRAM 速度更快。" },
  { chapter: "存储器系统", section: "地址译码", cue: "全译码的特点", correct: "所有相关高位地址线都参与片选译码，可避免地址重叠", wrong: ["完全不使用高位地址线", "必然产生多个镜像地址", "只适合 I/O 端口"], explanation: "部分译码电路简单但会产生地址重叠，全译码地址唯一。" },
  { chapter: "存储器系统", section: "容量与位扩展", cue: "存储器芯片的位扩展", correct: "多片芯片并行提供同一地址的不同数据位", wrong: ["增加地址线以扩大字数", "把所有数据线短接", "仅改变片选电平而不连接数据线"], explanation: "位扩展增加每个存储字的位数；字扩展则通过片选增加可寻址字数。" },
  { chapter: "存储器系统", section: "系统连接", cue: "存储器芯片与 CPU 的典型连接", correct: "低位地址线接片内地址，高位地址线参与片选译码", wrong: ["所有地址线都只接数据端", "读写控制线可以省略", "片选端永久无效"], explanation: "片内寻址和芯片选择共同确定唯一存储单元。" },
  { chapter: "存储器系统", section: "Cache 基础", cue: "Cache 提高性能的依据", correct: "程序访问具有时间局部性和空间局部性", wrong: ["Cache 容量一定大于主存", "Cache 可替代所有外存", "CPU 每次都绕过 Cache"], explanation: "把近期或邻近数据保存在高速缓存，可降低平均访存时间。" },

  { chapter: "I/O接口技术", section: "I/O 编址", cue: "I/O 独立编址", correct: "使用独立端口空间并由 IN/OUT 指令访问", wrong: ["端口必须占用代码段", "只能用 CALL 指令访问", "与存储器统一编址完全相同"], explanation: "独立编址把 I/O 空间与存储器空间分开，8086 用 IN 和 OUT 指令访问端口。" },
  { chapter: "I/O接口技术", section: "程序查询", cue: "程序查询方式的特点", correct: "CPU 反复读取状态并等待外设就绪", wrong: ["外设无需状态信号", "数据完全绕过 CPU", "CPU 可在等待期间自动执行任意其他任务"], explanation: "查询方式结构简单，但忙等会占用大量 CPU 时间。" },
  { chapter: "I/O接口技术", section: "中断传送", cue: "中断传送方式的优势", correct: "外设就绪后主动请求服务，CPU 无需持续轮询", wrong: ["不需要中断服务程序", "任何中断都不可屏蔽", "外设直接改写任意内存"], explanation: "中断方式提高 CPU 与外设并行工作的效率，但需要现场保护和中断管理。" },
  { chapter: "I/O接口技术", section: "DMA", cue: "DMA 传送的核心特征", correct: "DMA 控制器取得总线后在外设与存储器间直接传送", wrong: ["每个字节都必须由 CPU 执行 MOV", "只能传送一个位", "不需要初始化也没有结束通知"], explanation: "DMA 适合高速成块数据，CPU 主要负责初始化与传送结束处理。" },
  { chapter: "I/O接口技术", section: "接口设计", cue: "I/O 接口电路的基本职责", correct: "完成地址译码、数据缓冲、状态与控制协调", wrong: ["只提高 CPU 主频", "替代全部系统软件", "只负责存放中断向量"], explanation: "接口用于匹配 CPU 与外设在速度、时序、信号形式等方面的差异。" },

  { chapter: "8255A并行接口", section: "三种工作方式", cue: "8255A 方式 2 的适用端口", correct: "方式 2 仅用于 A 口的双向选通传送", wrong: ["三个端口都可独立使用方式 2", "方式 2 只能用于 C 口", "方式 2 是定时器方式"], explanation: "方式 2 为 A 口提供双向总线及联络信号，B 口不支持方式 2。" },
  { chapter: "8255A并行接口", section: "方式控制字", cue: "8255A 控制字 D7 的含义", correct: "D7=1 选择工作方式控制字，D7=0 选择 C 口位控字", wrong: ["D7 只决定 A 口地址", "D7 始终必须为 0", "D7 用来输入计数初值"], explanation: "两类控制字都写入控制口，由最高位区分。" },
  { chapter: "8255A并行接口", section: "端口地址", cue: "8255A 内部端口选择", correct: "A1A0 通常依次选择 A口、B口、C口和控制口", wrong: ["只需要一根地址线选择四个端口", "端口地址与 A1A0 无关", "控制口与 A 口总是同址"], explanation: "A1A0=00、01、10、11 分别对应四个内部端口。" },
  { chapter: "8255A并行接口", section: "初始化编程", cue: "8255A 初始化的关键步骤", correct: "向控制口写入与所需方向和方式对应的控制字", wrong: ["把控制字写入代码段寄存器", "只复位 CPU 即可自动配置", "先向中断向量表写端口数据"], explanation: "控制字确定 A/B/C 口方向、A/B 组工作方式或 C 口位操作。" },

  { chapter: "中断系统与8259A", section: "中断向量", cue: "8086 中断向量的大小", correct: "每个中断向量占 4 字节，依次包含 IP 与 CS", wrong: ["每个向量占 1 字节", "向量只保存 FLAGS", "向量表位于显存中"], explanation: "类型号 N 的向量首地址为 4N，中断向量表位于物理地址最低 1KB。" },
  { chapter: "中断系统与8259A", section: "中断响应流程", cue: "8086 接受中断后的自动操作", correct: "保存 FLAGS 和返回地址，并装入新的 CS:IP", wrong: ["自动保存所有通用寄存器", "自动执行普通 RET", "立即擦除中断向量表"], explanation: "通用寄存器通常由服务程序自行保护，结束时用 IRET 恢复断点和标志。" },
  { chapter: "中断系统与8259A", section: "8259A 结构", cue: "8259A 的 IRR、IMR 与 ISR", correct: "分别记录请求、屏蔽和正在服务的中断", wrong: ["分别保存地址、数据和指令", "都只用于计数", "三者内容始终相同"], explanation: "优先级判决器综合这些寄存器决定下一项可响应请求。" },
  { chapter: "中断系统与8259A", section: "级联", cue: "1 主 8 从的 8259A 级联能力", correct: "最多管理 64 个中断源", wrong: ["最多管理 8 个中断源", "最多管理 16 个中断源", "最多管理 72 个中断源"], explanation: "主片 8 条 IR 线各接一片从片，每片从片管理 8 个源，共 8×8=64。" },
  { chapter: "中断系统与8259A", section: "ICW 与 OCW", cue: "8259A 初始化命令字与操作命令字", correct: "ICW 用于初始化，OCW 用于运行中的屏蔽、EOI 和优先级控制", wrong: ["ICW 只存放用户数据", "OCW 只能在复位前写入", "两类命令字都写入存储器芯片"], explanation: "ICW1～ICW4 建立基本工作方式，OCW1～OCW3 管理运行状态。" },

  { chapter: "8253/8254定时器", section: "六种工作方式", cue: "8253/8254 方式 3", correct: "可作为方波发生器，输出占空比接近 1:1", wrong: ["只能输出一次高电平且不可重装", "专门用于串口接收", "不需要时钟输入"], explanation: "方式 3 常用于周期方波；方式 2 常用作率发生器。" },
  { chapter: "8253/8254定时器", section: "计数初值", cue: "定时器分频初值的计算", correct: "计数初值 N=fCLK/fOUT", wrong: ["N=fOUT/fCLK", "N=fCLK+fOUT", "N 与输入输出频率无关"], explanation: "理想分频场景下，计数周期数就是输入频率与输出频率之比。" },
  { chapter: "8253/8254定时器", section: "控制字", cue: "8253/8254 控制字的内容", correct: "包含通道选择、读写格式、工作方式和数制", wrong: ["只包含端口基地址", "只包含中断类型号", "用于保存 8086 段地址"], explanation: "初始化时先写控制字，再按指定格式写入计数初值。" },
  { chapter: "8253/8254定时器", section: "初始化编程", cue: "16 位计数初值的常见写入方式", correct: "按控制字约定先写低字节、再写高字节", wrong: ["只能一次写入 32 位", "先写高字节且无需控制字", "写入顺序由 CF 决定"], explanation: "当读写格式为低字节后高字节时，两次 OUT 必须写向同一计数通道端口。" },
  { chapter: "8253/8254定时器", section: "应用设计", cue: "两个计数通道级联", correct: "可把前级输出接到后级时钟，实现两级分频", wrong: ["会使两个通道都停止计数", "只能用于扩大数据总线", "级联后分频比固定为 2"], explanation: "两级总分频比约为两个通道计数初值的乘积。" },

  { chapter: "串行通信与8251A", section: "同步与异步", cue: "同步通信与异步通信的差异", correct: "异步字符通常带起始位和停止位，同步传送按数据块保持时钟同步", wrong: ["异步通信完全不需要时序", "同步通信每位都加起始位", "二者的帧开销必然相同"], explanation: "异步方式易于字符级同步，同步方式在连续数据块传输时效率更高。" },
  { chapter: "串行通信与8251A", section: "波特率与帧格式", cue: "异步串行字符帧", correct: "通常由起始位、数据位、可选校验位和停止位组成", wrong: ["只含数据位没有同步信息", "总是先发送最高有效位", "每帧长度固定为 8 位"], explanation: "常见异步传送低位先发，帧总位数决定有效数据传输效率。" },
  { chapter: "串行通信与8251A", section: "控制字", cue: "8251A 方式字与命令字", correct: "方式字配置帧格式与波特率因子，命令字控制收发使能等状态", wrong: ["方式字只设置存储器地址", "命令字用来写中断向量", "两者必须同时写入数据口"], explanation: "复位后先写方式字，随后用命令字控制收发、复位错误等操作。" },
  { chapter: "串行通信与8251A", section: "初始化编程", cue: "8251A 异步方式初始化顺序", correct: "复位后先写方式字，再写命令字", wrong: ["先连续写两个数据字节即可", "必须先初始化 8255A", "顺序完全没有要求"], explanation: "芯片用写入时序区分不同控制信息，顺序错误会导致配置被误解释。" },

  { chapter: "A/D与D/A转换", section: "采样量化编码", cue: "n 位 A/D 转换器的理论量化级数", correct: "共有 2^n 个量化码", wrong: ["共有 n 个量化码", "共有 2n 个量化码", "量化级数只由采样频率决定"], explanation: "位数决定数字编码数量；满量程除以 2^n 可近似得到每个最低有效位对应的电压。" },
  { chapter: "A/D与D/A转换", section: "DAC0832", cue: "DAC0832 双缓冲方式", correct: "可先装入数据，再让多个通道同步更新模拟输出", wrong: ["可以不接参考电源", "会把 8 位转换器变为 16 位", "只能用于输入模拟量"], explanation: "双缓冲隔离输入寄存器和 DAC 寄存器，适合多路同步更新。" },
  { chapter: "A/D与D/A转换", section: "ADC0809", cue: "ADC0809 的 EOC 信号", correct: "用于指示 A/D 转换是否结束", wrong: ["用于选择 CPU 最小模式", "用于写入 8255A 控制字", "只表示模拟输入过零"], explanation: "启动转换后可查询 EOC 或用其触发中断，转换结束后再读取数字结果。" },
  { chapter: "A/D与D/A转换", section: "接口编程", cue: "A/D 接口程序的基本流程", correct: "选择通道、启动转换、等待结束、读取结果", wrong: ["先读取结果再接通电源", "只需无限写同一数据", "无需考虑转换时间"], explanation: "轮询或中断均应保证在转换完成后读取稳定的数字量。" },
  { chapter: "A/D与D/A转换", section: "波形生成", cue: "用 D/A 转换器生成锯齿波", correct: "周期性递增数字量并按固定节拍送往 D/A 端口", wrong: ["始终输出同一个数字量", "只读 ADC 的 EOC", "关闭时钟后波形频率更稳定"], explanation: "数字码的递增步长与输出间隔共同决定锯齿波幅度分辨率和频率。" },
];

const promptPatterns = [
  (seed: ConceptSeed) => `关于“${seed.cue}”，下列说法正确的是（ ）。`,
  (seed: ConceptSeed) => `复习“${seed.section}”时，与“${seed.cue}”对应的正确结论是（ ）。`,
  (seed: ConceptSeed) => `在典型的“${seed.cue}”问题中，应采用的判断是（ ）。`,
  (seed: ConceptSeed) => `下列哪一项准确描述了“${seed.cue}”（ ）。`,
  (seed: ConceptSeed) => `针对“${seed.cue}”进行考点辨析，正确选项是（ ）。`,
  (seed: ConceptSeed) => `完成“${seed.section}”专项训练时，哪项结论成立（ ）。`,
];

function buildGeneratedQuestions(): Question[] {
  let nextId = 849100;
  const generated: Question[] = [];
  for (const chapter of chapterGroups) {
    const chapterStarters = starterQuestions.filter((question) => question.chapter === chapter.name);
    const chapterSeeds = conceptSeeds.filter((seed) => seed.chapter === chapter.name);
    const needed = Math.max(0, chapter.target - chapterStarters.length);
    for (let index = 0; index < needed; index += 1) {
      const seed = chapterSeeds[index % chapterSeeds.length];
      const round = Math.floor(index / chapterSeeds.length);
      const shift = (index + round) % 4;
      const options = [seed.correct, ...seed.wrong];
      const rotated = options.map((_, optionIndex) => options[(optionIndex + shift) % options.length]);
      const answer = String.fromCharCode(65 + rotated.indexOf(seed.correct));
      generated.push({
        id: nextId++,
        chapter: seed.chapter,
        section: seed.section,
        type: "选择题",
        difficulty: (["基础", "强化", "综合"] as const)[(index + round) % 3],
        prompt: promptPatterns[round % promptPatterns.length](seed),
        options: rotated,
        answer,
        explanation: seed.explanation,
        keypoint: seed.cue,
      });
    }
  }
  return generated;
}

const generatedQuestions = buildGeneratedQuestions();
const questions: Question[] = chapterGroups.flatMap((chapter) => [
  ...starterQuestions.filter((question) => question.chapter === chapter.name),
  ...generatedQuestions.filter((question) => question.chapter === chapter.name),
]);
const PAGE_LOADED_AT = Date.now();

const plannedQuestionCount = chapterGroups.reduce((total, chapter) => total + chapter.target, 0);
const topicCount = chapterGroups.reduce((total, chapter) => total + chapter.sections.length, 0);

const navItems = [
  { id: "home", label: "学习首页", icon: "⌂" },
  { id: "practice", label: "章节刷题", icon: "◎" },
  { id: "mastery", label: "题库目录", icon: "◫" },
  { id: "plan", label: "学习计划", icon: "▤" },
  { id: "exam", label: "组卷考试", icon: "◈" },
  { id: "mistakes", label: "错题复测", icon: "↻" },
] as const;

type View = (typeof navItems)[number]["id"];
type FontSize = "small" | "standard" | "large" | "xlarge";
type StoredProgress = Record<number, "mastered" | "unsure" | "mistake">;
type ReviewRecord = { stage: number; nextReviewAt: string | null; attempts: number; correctAttempts: number };
type StoredReviews = Record<number, ReviewRecord>;
type AccountSummary = { displayName: string; email: string };
type PlanItem = { planDate: string; chapter: string; targetQuestions: number; completedQuestions: number; status: string };

const fontSizes: Array<{ id: FontSize; label: string }> = [
  { id: "small", label: "小" },
  { id: "standard", label: "标准" },
  { id: "large", label: "大" },
  { id: "xlarge", label: "特大" },
];

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("standard");
  const [selectedChapter, setSelectedChapter] = useState("全部章节");
  const [difficulty, setDifficulty] = useState("全部难度");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [progress, setProgress] = useState<StoredProgress>({});
  const [reviews, setReviews] = useState<StoredReviews>({});
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [syncState, setSyncState] = useState<"loading" | "synced" | "local" | "error">("loading");
  const [dailyGoal, setDailyGoal] = useState(20);
  const [examDate, setExamDate] = useState("2026-12-19");
  const [planChapter, setPlanChapter] = useState(chapterGroups[0].name);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [examChapter, setExamChapter] = useState("全部章节");
  const [examSize, setExamSize] = useState(20);
  const [examQueue, setExamQueue] = useState<number[]>([]);
  const [examIndex, setExamIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState<Record<number, string>>({});
  const [examInput, setExamInput] = useState("");
  const [examStartedAt, setExamStartedAt] = useState(0);
  const [examResult, setExamResult] = useState<{ score: number; total: number } | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("micro849-progress");
    const savedReviews = localStorage.getItem("micro849-reviews");
    const savedPlans = localStorage.getItem("micro849-plans");
    const savedTheme = localStorage.getItem("micro849-theme");
    const savedFontSize = localStorage.getItem("micro849-font-size") as FontSize | null;
    queueMicrotask(() => {
      try { if (saved) setProgress(JSON.parse(saved)); } catch { localStorage.removeItem("micro849-progress"); }
      try { if (savedReviews) setReviews(JSON.parse(savedReviews)); } catch { localStorage.removeItem("micro849-reviews"); }
      try { if (savedPlans) setPlanItems(JSON.parse(savedPlans)); } catch { localStorage.removeItem("micro849-plans"); }
      if (savedTheme === "dark") setDark(true);
      if (savedFontSize && fontSizes.some((size) => size.id === savedFontSize)) setFontSize(savedFontSize);
    });

    fetch("/api/account", { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) { setSyncState("local"); return null; }
      if (!response.ok) throw new Error("sync failed");
      return response.json();
    }).then((data) => {
      if (!data) return;
      setAccount(data.user);
      setDailyGoal(data.profile?.dailyGoal ?? 20);
      setExamDate(data.profile?.examDate ?? "2026-12-19");
      const syncedProgress: StoredProgress = {};
      const syncedReviews: StoredReviews = {};
      for (const item of data.progress ?? []) {
        syncedProgress[item.questionId] = item.status;
        syncedReviews[item.questionId] = { stage: item.reviewStage, nextReviewAt: item.nextReviewAt, attempts: item.attempts, correctAttempts: item.correctAttempts };
      }
      setProgress((local) => ({ ...local, ...syncedProgress }));
      setReviews((local) => ({ ...local, ...syncedReviews }));
      setPlanItems(data.plans ?? []);
      setSyncState("synced");
    }).catch(() => setSyncState("error"));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("micro849-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
    localStorage.setItem("micro849-font-size", fontSize);
  }, [fontSize]);

  function adjustFontSize(direction: -1 | 1) {
    const current = fontSizes.findIndex((size) => size.id === fontSize);
    const next = Math.min(fontSizes.length - 1, Math.max(0, current + direction));
    setFontSize(fontSizes[next].id);
  }

  const filteredQuestions = useMemo(
    () => questions.filter((question) =>
      (view !== "mistakes" || (progress[question.id] === "mistake" && (!reviews[question.id]?.nextReviewAt || new Date(reviews[question.id].nextReviewAt!).getTime() <= PAGE_LOADED_AT))) &&
      (selectedChapter === "全部章节" || question.chapter === selectedChapter) &&
      (difficulty === "全部难度" || question.difficulty === difficulty)),
    [selectedChapter, difficulty, view, progress, reviews],
  );
  const currentQuestion = filteredQuestions[questionIndex] ?? filteredQuestions[0];
  const mastered = Object.values(progress).filter((value) => value === "mastered").length;
  const mistakes = Object.values(progress).filter((value) => value === "mistake").length;
  const dueReviews = questions.filter((question) => progress[question.id] === "mistake" && (!reviews[question.id]?.nextReviewAt || new Date(reviews[question.id].nextReviewAt!).getTime() <= PAGE_LOADED_AT)).length;
  const accuracy = Object.keys(progress).length ? Math.round((mastered / Object.keys(progress).length) * 100) : 0;
  const daysLeft = Math.max(0, Math.ceil((new Date(`${examDate}T08:30:00+08:00`).getTime() - PAGE_LOADED_AT) / 86400000));
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

  function postSync(payload: Record<string, unknown>) {
    if (!account) return;
    fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      .then((response) => { if (!response.ok) throw new Error("sync failed"); setSyncState("synced"); })
      .catch(() => setSyncState("error"));
  }

  function recordQuestion(question: Question, correct: boolean, requestedStatus?: StoredProgress[number], reviewing = false) {
    const old = reviews[question.id] ?? { stage: 0, nextReviewAt: null, attempts: 0, correctAttempts: 0 };
    let status: StoredProgress[number] = requestedStatus ?? (correct ? "mastered" : "mistake");
    let stage = old.stage;
    let nextReviewAt: string | null = old.nextReviewAt;
    if (!correct || status === "mistake") {
      stage = 0;
      nextReviewAt = new Date(Date.now() + 86400000).toISOString();
      status = "mistake";
    } else if (reviewing) {
      stage = old.stage + 1;
      if (stage >= 5) { status = "mastered"; nextReviewAt = null; }
      else { status = "mistake"; nextReviewAt = new Date(Date.now() + [1, 3, 7, 15, 30][stage] * 86400000).toISOString(); }
    } else if (status === "unsure") {
      nextReviewAt = new Date(Date.now() + 3 * 86400000).toISOString();
    } else {
      nextReviewAt = null;
    }
    const nextProgress = { ...progress, [question.id]: status };
    const nextReviews = { ...reviews, [question.id]: { stage, nextReviewAt, attempts: old.attempts + 1, correctAttempts: old.correctAttempts + (correct ? 1 : 0) } };
    setProgress(nextProgress); setReviews(nextReviews);
    localStorage.setItem("micro849-progress", JSON.stringify(nextProgress));
    localStorage.setItem("micro849-reviews", JSON.stringify(nextReviews));
    postSync({ action: "progress", questionId: question.id, status, correct, reviewStage: stage, nextReviewAt });
    return status;
  }

  function markQuestion(status: StoredProgress[number]) {
    if (!currentQuestion) return;
    const finalStatus = recordQuestion(currentQuestion, status === "mastered", status, view === "mistakes" && status === "mastered");
    setNotice(finalStatus === "mastered" ? "已掌握并完成当前复测周期" : finalStatus === "mistake" ? "已安排下一次间隔复测" : "已标记为模糊，3 天后提醒");
    window.setTimeout(() => setNotice(""), 1800);
  }

  function nextQuestion() {
    if (!filteredQuestions.length) return;
    setQuestionIndex((index) => (index + 1) % filteredQuestions.length); setSelectedAnswer(""); setRevealed(false);
  }

  function savePlan() {
    const planDate = new Date().toISOString().slice(0, 10);
    const item = { planDate, chapter: planChapter, targetQuestions: dailyGoal, completedQuestions: 0, status: "pending" };
    const next = [item, ...planItems.filter((plan) => !(plan.planDate === planDate && plan.chapter === planChapter))];
    setPlanItems(next); localStorage.setItem("micro849-plans", JSON.stringify(next));
    postSync({ action: "profile", dailyGoal, examDate });
    postSync({ action: "plan", ...item });
    setNotice("今日学习计划已生成"); window.setTimeout(() => setNotice(""), 1800);
  }

  function startExam() {
    const pool = questions.filter((question) => examChapter === "全部章节" || question.chapter === examChapter);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(examSize, pool.length));
    setExamQueue(shuffled.map((question) => question.id)); setExamIndex(0); setExamAnswers({}); setExamInput(""); setExamResult(null); setExamStartedAt(Date.now());
  }

  function submitExamStep() {
    const question = questions.find((item) => item.id === examQueue[examIndex]);
    if (!question || !examInput.trim()) return;
    const answers = { ...examAnswers, [question.id]: examInput };
    setExamAnswers(answers);
    if (examIndex < examQueue.length - 1) { setExamIndex(examIndex + 1); setExamInput(""); return; }
    let score = 0;
    const nextProgress = { ...progress };
    const nextReviews = { ...reviews };
    for (const id of examQueue) {
      const item = questions.find((candidate) => candidate.id === id)!;
      const given = answers[id] ?? "";
      const correct = [item.answer, ...(item.accepted ?? [])].some((answer) => answer.replace(/\s/g, "").toUpperCase() === given.replace(/\s/g, "").toUpperCase());
      const old = nextReviews[id] ?? { stage: 0, nextReviewAt: null, attempts: 0, correctAttempts: 0 };
      const status: StoredProgress[number] = correct ? "mastered" : "mistake";
      const nextReviewAt = correct ? null : new Date(Date.now() + 86400000).toISOString();
      nextProgress[id] = status;
      nextReviews[id] = { stage: 0, nextReviewAt, attempts: old.attempts + 1, correctAttempts: old.correctAttempts + (correct ? 1 : 0) };
      postSync({ action: "progress", questionId: id, status, correct, reviewStage: 0, nextReviewAt });
      if (correct) score += 1;
    }
    setProgress(nextProgress); setReviews(nextReviews);
    localStorage.setItem("micro849-progress", JSON.stringify(nextProgress));
    localStorage.setItem("micro849-reviews", JSON.stringify(nextReviews));
    const durationSeconds = Math.round((Date.now() - examStartedAt) / 1000);
    setExamResult({ score, total: examQueue.length });
    postSync({ action: "exam", scope: examChapter, questionIds: examQueue, answers, score, total: examQueue.length, durationSeconds });
  }

  const heat = Array.from({ length: 70 }, (_, index) => index === 69 ? Math.min(4, Object.keys(progress).length) : 0);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`} aria-label="学习导航">
        <div className="brand"><div className="brand-mark" aria-hidden="true"><span>8</span><span>49</span></div><div><strong>微机研习社</strong><small>849 STUDY LAB</small></div></div>
        <nav className="main-nav" aria-label="主要功能">
          <p className="nav-title">学习工作台</p>
          {navItems.map((item) => <button key={item.id} className={view === item.id ? "nav-active" : ""} onClick={() => switchView(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}{item.id === "mistakes" && <em>{dueReviews}</em>}</button>)}
        </nav>
        <div className="chapter-nav"><p className="nav-title">知识树 · 11章</p>{chapterGroups.map((chapter) => { const online = questions.filter((question) => question.chapter === chapter.name).length; return <button key={chapter.name} onClick={() => beginChapter(chapter.name)}><span>{chapter.code}</span><div><strong>{chapter.name}</strong><small>{chapter.sections.length} 专题 · {online}/{chapter.target} 题</small></div><i style={{ "--p": `${chapter.progress}%` } as React.CSSProperties} /></button>; })}</div>
        <div className="book-card"><span>参考教材</span><strong>《微型计算机原理与接口技术》</strong><small>周荷琴、冯焕清等 · 第6版</small></div>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="打开学习导航">☰</button>
          <div className="breadcrumb"><span>849 微机原理及应用</span><b>/</b><strong>{navItems.find((item) => item.id === view)?.label}</strong></div>
          <div className="top-actions"><button className="search-button" onClick={() => { setView("practice"); setNotice("已进入题库，可按章节筛选"); }}>⌕ <span>搜索题目</span><kbd>⌘ K</kbd></button><div className="font-controls" role="group" aria-label="调节网站字体大小"><button onClick={() => adjustFontSize(-1)} disabled={fontSize === "small"} aria-label="缩小字体">A−</button><span>字号 {fontSizes.find((size) => size.id === fontSize)?.label}</span><button onClick={() => adjustFontSize(1)} disabled={fontSize === "xlarge"} aria-label="放大字体">A＋</button></div><button className="icon-button" onClick={() => setDark(!dark)} aria-label="切换深色模式">{dark ? "☀" : "☾"}</button>{account ? <a className="account-chip" href="/signout-with-chatgpt?return_to=%2F" title={`${account.email} · 点击退出`}><span>{account.displayName.slice(0, 1).toUpperCase()}</span><small>{syncState === "synced" ? "已同步" : "同步中"}</small></a> : <a className="signin-button" href="/signin-with-chatgpt?return_to=%2F">登录同步</a>}</div>
        </header>

        <main>
          {view === "home" && <>
            <section className="hero-panel">
              <div className="hero-copy"><span className="eyebrow"><i /> 2027 考研 · 上海理工大学</span><h1>把 849 的每一个<br /><em>失分点</em>，练成得分点。</h1><p>依据考试大纲、章节讲义与有效周练拆解知识点；第三方资料只用于考点提炼，公开题目均重新命制。</p><div className="hero-actions"><button className="primary-button" onClick={() => beginChapter("8086 CPU结构")}>开始章节训练 <span>→</span></button><button className="secondary-button" onClick={() => switchView("exam")}>快速组卷</button></div><div className="hero-meta"><span>✓ 11 章 52 专题</span><span>✓ {questions.length} 道原创改写题</span><span>✓ {account ? "账户跨设备同步" : "登录后跨设备同步"}</span></div></div>
              <div className="countdown-card"><div className="circuit-corner" /><span>距离预计初试</span><strong>{daysLeft}</strong><b>DAYS</b><p>目标：完成 3 轮知识闭环</p><div className="countdown-track"><i /></div><small>当前阶段 · 基础强化</small></div>
            </section>
            <section className="stats-grid" aria-label="学习概览">
              <article><span className="stat-icon cyan">∿</span><div><small>{account ? "账户已练" : "本机已练"}</small><strong>{Object.keys(progress).length}<em>题</em></strong><p>题库已上线 {questions.length} 题</p></div></article>
              <article><span className="stat-icon amber">◎</span><div><small>当前正确率</small><strong>{accuracy}<em>%</em></strong><p>按本机作答实时计算</p></div></article>
              <article><span className="stat-icon violet">◇</span><div><small>已掌握题目</small><strong>{mastered}<em>/ {questions.length}</em></strong><p>{topicCount} 个专题待逐步覆盖</p></div></article>
              <article><span className="stat-icon red">↻</span><div><small>今日到期复测</small><strong>{dueReviews}<em> / {mistakes} 题</em></strong><button onClick={() => switchView("mistakes")}>开始复测 →</button></div></article>
            </section>
            <section className="source-strip" aria-label="题库建设说明"><div><span>资料清理结果</span><h2>从 112 项课程资料中提炼有效考点</h2><p>已排除空文件、宣传页、重复图片与非 849 内容；答案文件仅作校核，商业题面不直接公开。</p></div><dl><div><dt>11</dt><dd>一级章节</dd></div><div><dt>{topicCount}</dt><dd>二级专题</dd></div><div><dt>{plannedQuestionCount}</dt><dd>目标题量</dd></div><div><dt>{questions.length}</dt><dd>已全部上线</dd></div></dl></section>
            <section className="dashboard-grid">
              <article className="study-card"><div className="section-heading"><div><span>今日任务</span><h2>继续你的学习计划</h2></div><button onClick={() => switchView("practice")}>全部任务</button></div><div className="task-list">
                <button onClick={() => beginChapter("寻址与指令系统")}><span className="task-number">01</span><div><b>寻址方式 · 强化训练</b><small>寻址与指令系统 · 28 道分类题</small></div><em><i style={{ width: "0%" }} />未开始</em><strong>开始 →</strong></button>
                <button onClick={() => beginChapter("存储器系统")}><span className="task-number">02</span><div><b>存储器地址与容量扩展</b><small>存储器系统 · 18 道分类题</small></div><em><i style={{ width: "0%" }} />未开始</em><strong>开始 →</strong></button>
                <button onClick={() => beginChapter("中断系统与8259A")}><span className="task-number">03</span><div><b>中断向量与响应过程</b><small>中断系统与8259A · 18 道分类题</small></div><em><i style={{ width: "0%" }} />未开始</em><strong>开始 →</strong></button>
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
            <div className="legend"><span><i className="good" />已掌握</span><span><i className="weak" />需强化</span><span><i className="new" />未开始</span><small>{account ? "掌握度已与账户同步。" : "当前保存在本机；登录后可跨设备同步。"}</small></div>
          </section>}

          {view === "plan" && <section className="workspace-view">
            <div className="practice-header"><div><span className="eyebrow"><i /> SMART STUDY PLAN</span><h1>学习计划</h1><p>按考试日期和每日题量安排训练，优先覆盖未练与薄弱章节。</p></div><div className="question-count"><strong>{daysLeft}</strong><span>距离考试 / 天</span></div></div>
            <div className="plan-layout">
              <article className="tool-card"><div className="section-heading"><div><span>计划设置</span><h2>生成今日任务</h2></div><b>{account ? "自动同步" : "本机模式"}</b></div>
                <div className="form-grid"><label>预计考试日期<input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} /></label><label>每日目标题量<input type="number" min="5" max="100" value={dailyGoal} onChange={(event) => setDailyGoal(Math.min(100, Math.max(5, Number(event.target.value))))} /></label><label className="wide">今日主攻章节<select value={planChapter} onChange={(event) => setPlanChapter(event.target.value)}>{chapterGroups.map((chapter) => <option key={chapter.name}>{chapter.name}</option>)}</select></label></div>
                <button className="primary-button" onClick={savePlan}>生成并保存计划</button>
                {!account && <p className="auth-hint">当前计划只保存在本机。<a href="/signin-with-chatgpt?return_to=%2F">登录 ChatGPT</a> 后可跨设备同步。</p>}
              </article>
              <article className="tool-card"><div className="section-heading"><div><span>今日节奏</span><h2>{dailyGoal} 题学习闭环</h2></div></div><ol className="plan-steps"><li><b>01</b><span><strong>新题训练</strong><small>{Math.max(1, Math.round(dailyGoal * .6))} 题 · 当前主攻章节</small></span></li><li><b>02</b><span><strong>到期错题复测</strong><small>{Math.min(dueReviews, Math.max(1, Math.round(dailyGoal * .25)))} 题 · 1/3/7/15/30 天间隔</small></span></li><li><b>03</b><span><strong>随机巩固</strong><small>{Math.max(1, Math.round(dailyGoal * .15))} 题 · 混合组卷</small></span></li></ol></article>
            </div>
            <article className="tool-card plan-history"><div className="section-heading"><div><span>已保存任务</span><h2>最近学习计划</h2></div></div>{planItems.length ? <div className="history-list">{planItems.slice(0, 10).map((item, index) => <button key={`${item.planDate}-${item.chapter}-${index}`} onClick={() => beginChapter(item.chapter)}><span>{item.planDate}</span><strong>{item.chapter}</strong><em>{item.completedQuestions}/{item.targetQuestions} 题</em><b>{item.status === "completed" ? "已完成" : "去学习 →"}</b></button>)}</div> : <div className="empty-inline">还没有计划，先生成今天的第一项任务。</div>}</article>
          </section>}

          {view === "exam" && <section className="workspace-view">
            <div className="practice-header"><div><span className="eyebrow"><i /> EXAM BUILDER</span><h1>组卷考试</h1><p>支持全范围或章节专项随机组卷，交卷后自动统计并安排错题复测。</p></div><div className="question-count"><strong>{examQueue.length || examSize}</strong><span>本卷题量</span></div></div>
            {!examQueue.length || examResult ? <div className="exam-layout"><article className="tool-card"><div className="section-heading"><div><span>组卷参数</span><h2>创建一套练习卷</h2></div></div><div className="form-grid"><label className="wide">考试范围<select value={examChapter} onChange={(event) => setExamChapter(event.target.value)}><option>全部章节</option>{chapterGroups.map((chapter) => <option key={chapter.name}>{chapter.name}</option>)}</select></label><label className="wide">题目数量<select value={examSize} onChange={(event) => setExamSize(Number(event.target.value))}><option value="10">10 题 · 快速检测</option><option value="20">20 题 · 专项训练</option><option value="40">40 题 · 综合模拟</option></select></label></div><button className="primary-button" onClick={startExam}>{examResult ? "再组一卷" : "开始考试"}</button></article>{examResult && <article className="result-card"><span>本次成绩</span><strong>{examResult.score}<em>/ {examResult.total}</em></strong><p>正确率 {Math.round(examResult.score / examResult.total * 100)}%</p><small>错题已自动进入间隔复测队列。</small></article>}</div> : (() => { const examQuestion = questions.find((question) => question.id === examQueue[examIndex]); if (!examQuestion) return null; return <article className="question-card"><div className="exam-progress"><span style={{ width: `${((examIndex + 1) / examQueue.length) * 100}%` }} /></div><div className="question-meta"><span>第 {examIndex + 1} / {examQueue.length} 题</span><b>{examQuestion.chapter}</b><b>{examQuestion.section}</b><em data-difficulty={examQuestion.difficulty}>{examQuestion.difficulty}</em></div><h2>{examQuestion.prompt}</h2>{examQuestion.options ? <div className="options-list">{examQuestion.options.map((option, index) => { const letter = String.fromCharCode(65 + index); return <button key={letter} className={examInput === letter ? "selected" : ""} onClick={() => setExamInput(letter)}><span>{letter}</span>{option}</button>; })}</div> : <label className="answer-input">你的答案<input value={examInput} onChange={(event) => setExamInput(event.target.value)} /></label>}<div className="question-footer"><span className="exam-note">考试中不显示答案与解析</span><button className="next-button" onClick={submitExamStep} disabled={!examInput.trim()}>{examIndex === examQueue.length - 1 ? "交卷并评分" : "保存并下一题 →"}</button></div></article>; })()}
          </section>}
        </main>
        <footer><span>849 微机研习社 · 题库、计划、组卷与间隔复测</span><span>依据考试大纲与课程资料提炼 · 第三方材料不原样公开</span></footer>
      </div>
      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="关闭导航" />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
