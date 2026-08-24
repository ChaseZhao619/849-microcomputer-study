# 849 微机研习社

> [!CAUTION]
> **版权声明 / COPYRIGHT NOTICE**<br>
> **本仓库的软件代码与题库内容采用不同的授权方式。MIT License 仅适用于软件源代码，不适用于题目、选项、答案、解析、课程资料及其衍生内容。公开仓库不代表上述内容进入公有领域，也不代表任何人获得复制、传播、转售或商业使用权。**<br>
> **The software source code and the educational content in this repository are licensed separately. The MIT License applies only to the software source code. It does not apply to questions, choices, answers, explanations, course materials, or derivative educational content. Public availability does not place that content in the public domain or grant permission to copy, redistribute, resell, or commercially exploit it.**

849 微机研习社是一个面向计算机专业课学习与复习的在线题库系统，提供分类练习、学习计划、组卷考试、错题记录和间隔复测等功能。

站点采用“公开浏览、登录后学习”模式：访客可查看首页介绍和题库目录，任何 ChatGPT 用户登录后均可进入题目、搜索、学习计划、学习数据、组卷考试和错题复测。

- 在线访问：[849 微机研习社](https://chase849.hebuyijiangnan.chatgpt.site)
- 技术栈：Next.js、React、TypeScript、Cloudflare D1、Drizzle ORM、Vinext

## 主要功能

- 按知识类别浏览和练习题目
- `⌘K` / `Ctrl+K` 多关键词题库搜索
- 账户信息与学习进度同步
- 自动回填完成进度的学习计划
- 7、30、70 天个人学习数据中心，分开展示客观正确率与主观得分率
- 仿 A3 双栏整卷考试，题目页码与栏位在恢复后保持稳定，并可切换专注模式
- 主观题支持键盘、触控笔手写和拍照上传，笔迹可撤销、重做和多页保存
- 带倒计时、答题卡、暂存续考、量规自评和独立成绩页的完整考试流程
- 用户自备 Token 的千问、OpenAI 视觉转写及 DeepSeek 文字复核
- 错题收集和间隔复测
- 最近10个完整自然周的真实作答热力图
- 可展开或收起的侧边导航
- 字体大小调节和阅读体验优化
- 账户设置与学习 ID 修改
- 搜索和设置对话框的完整键盘焦点管理

题库配额、相似度与高风险题说明见[逐题编辑复核摘要](./docs/question-bank-review.md)。

## 本地运行

### 环境要求

- Node.js `>= 22.13.0`
- npm

### 启动步骤

```bash
npm ci
npm run dev
```

按照终端提示在浏览器中打开本地地址即可。

常用命令：

```bash
npm run dev          # 启动开发环境
npm run build        # 构建部署版本
npm test             # 构建并运行测试
npm run lint         # 代码检查
npm run db:generate  # 生成数据库迁移
```

## 项目结构

```text
app/                 页面、样式与 API 路由
db/                  数据库连接和表结构
drizzle/             数据库迁移文件
public/              公共静态资源
scripts/             构建及环境脚本
tests/               自动化测试
worker/              Cloudflare Worker 入口
.openai/hosting.json Sites 托管配置
```

## 数据与隐私

- GitHub 仓库只保存程序源代码和随代码发布的静态内容，不包含线上用户账户、学习进度或错题记录。
- 线上数据存储在部署环境所绑定的数据库中，不会因为公开本仓库而自动公开。
- 未登录访客不能刷题、创建计划或参加考试；升级前已经产生的本机学习数据不会被主动删除，但需要登录后才能继续学习。
- 登录用户的答题图片和笔迹附件存放于私有 R2，并按 180 天保留期清理。
- AI 平台、模型、Token 与解锁入口集中在“个人设置”；配置一次后以 PBKDF2 与 AES-GCM 密文长期保存在本机，并由所有题目共用。为避免明文长期驻留，每次重新打开浏览器只需统一解锁一次；明文不写入账户、试卷、数据库或日志。
- 考试进行中，AI 接口只允许转写，不会接收参考答案和评分量规；交卷后的评分点建议仍需考生逐项确认。
- 站点提供仅供独立 owner-only 管理站调用的签名管理接口。请求使用时间戳、随机数、请求体摘要与 HMAC-SHA256 防篡改和防重放；接口不会返回答案正文、手写图片、对象存储键或 AI 转写。
- 管理员可维护私有备注/标签并停用或恢复账户云端能力；所有管理动作写入不可变审计记录。停用账户仍可浏览公开页面，但不能使用需要登录的学习功能。
- 请勿提交 `.env`、访问令牌、数据库密钥或其他私密配置。项目的 `.gitignore` 已默认排除常见敏感文件和构建产物。
- `.openai/hosting.json` 中的项目编号不是访问凭据；其他人无法仅凭该编号管理线上站点或读取数据库。

## 授权与版权

### 软件代码

除第三方依赖和另有说明的文件外，本仓库的软件源代码依据 [MIT License](./LICENSE) 开放使用。

### 题库及课程相关内容

题目、选项、答案、解析、课程资料以及基于课程资料整理或改写的内容，**不属于 MIT License 的授权范围**。相关内容的权利由各自权利人保留。除非取得权利人书面授权或法律另有允许，不得将这些内容复制、批量抓取、重新发布、转售、用于商业产品或作为模型训练数据。

本项目的公开与教育用途不构成对任何第三方商标、教材、课程或题库权利的主张。如权利人认为仓库中的内容侵犯其合法权益，请通过 [GitHub Issue](../../issues) 提交权属说明和具体文件位置，我们将及时核验并处理。

完整的中英文版权说明请阅读 [COPYRIGHT.md](./COPYRIGHT.md)。

### Software Code

Except for third-party dependencies and files explicitly marked otherwise, the software source code is available under the [MIT License](./LICENSE).

### Question Bank and Course-Related Content

Questions, choices, answers, explanations, course materials, and content organized or rewritten from course materials are **not licensed under the MIT License**. All such rights remain with their respective owners. Unless authorized in writing by the relevant rights holder or otherwise permitted by law, this content may not be copied, scraped in bulk, republished, resold, incorporated into commercial products, or used as model-training data.

The educational and public nature of this project does not assert ownership of any third-party trademark, textbook, course, or question-bank material. Rights holders may submit ownership information and precise file locations through a [GitHub Issue](../../issues) for review and appropriate action.

## 参与贡献

欢迎提交 Issue 或 Pull Request 改进程序功能。贡献代码即表示你有权提交该代码，并同意其按照本仓库的软件代码许可证发布。请勿提交来源不明、未经授权或含有个人信息的题库和课程资料。
