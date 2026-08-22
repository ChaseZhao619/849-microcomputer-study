import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const questions = JSON.parse(await readFile(new URL("../app/question-bank.json", import.meta.url), "utf8"));
const quotas = {
  "微型计算机基础": [13, 5, 0, 0], "8086 CPU结构": [17, 5, 2, 0], "寻址与指令系统": [14, 5, 8, 1],
  "汇编语言程序设计": [3, 2, 8, 1], "存储器系统": [11, 4, 0, 3], "I/O接口技术": [7, 2, 1, 3],
  "8255A并行接口": [8, 3, 4, 3], "中断系统与8259A": [9, 2, 3, 4], "8253/8254定时器": [10, 2, 2, 4],
  "串行通信与8251A": [7, 2, 1, 3], "A/D与D/A转换": [11, 3, 1, 3],
};
const types = ["选择题", "填空/计算题", "汇编编程题", "综合设计题"];

test("题库数量、章节与题型配额精确", () => {
  assert.equal(questions.length, 200);
  assert.deepEqual(types.map((type) => questions.filter((q) => q.type === type).length), [110, 35, 30, 25]);
  for (const [chapter, expected] of Object.entries(quotas)) {
    assert.deepEqual(types.map((type) => questions.filter((q) => q.chapter === chapter && q.type === type).length), expected, chapter);
  }
});

test("题号、题干、选项、答案和量规通过结构审计", () => {
  assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
  assert.equal(new Set(questions.map((q) => q.prompt.trim())).size, questions.length);
  for (const q of questions) {
    assert.ok(Number.isInteger(q.id) && q.prompt && q.chapter && q.section && q.keypoint);
    if (q.options) {
      assert.equal(q.options.length, 4, `#${q.id}`);
      assert.equal(new Set(q.options.map((option) => option.trim())).size, 4, `#${q.id}`);
      assert.ok("ABCD".includes(q.answer), `#${q.id}`);
    }
    if (q.scoring === "rubric") {
      assert.ok(q.rubric?.length >= 2, `#${q.id}`);
      assert.equal(q.rubric.reduce((sum, item) => sum + item.points, 0), q.points, `#${q.id}`);
    }
  }
});

function normalizedTrigrams(value) {
  const text = value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const result = new Set();
  for (let index = 0; index < text.length - 2; index += 1) result.add(text.slice(index, index + 3));
  return result;
}

test("规范化题干没有高相似模板变式", () => {
  const risky = [];
  for (let left = 0; left < questions.length; left += 1) {
    for (let right = left + 1; right < questions.length; right += 1) {
      const a = normalizedTrigrams(questions[left].prompt);
      const b = normalizedTrigrams(questions[right].prompt);
      if (!a.size || !b.size) continue;
      let overlap = 0;
      for (const gram of a) if (b.has(gram)) overlap += 1;
      const similarity = (2 * overlap) / (a.size + b.size);
      if (similarity >= 0.55) risky.push([questions[left].id, questions[right].id, similarity]);
    }
  }
  assert.deepEqual(risky, []);
});

test("搜索索引排除答案解析，并按精确题号优先", () => {
  const search = (query) => {
    const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return questions.filter((q) => {
      const indexed = [String(q.id), q.prompt, q.chapter, q.section, q.type, q.keypoint].join(" ").toLowerCase();
      return tokens.every((token) => indexed.includes(token));
    }).sort((a, b) => (String(a.id) === query ? -1 : 0) - (String(b.id) === query ? -1 : 0)).slice(0, 30);
  };
  assert.equal(search("EEH").some((q) => q.id === 849011), false);
  assert.equal(search("850149")[0].id, 850149);
  assert.ok(search("8255 控制字").every((q) => [q.id, q.prompt, q.chapter, q.section, q.type, q.keypoint].join(" ").includes("8255") && [q.id, q.prompt, q.chapter, q.section, q.type, q.keypoint].join(" ").includes("控制字")));
});
