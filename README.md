# AI 副本游戏 (AI Dungeon Instance Game)

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

这是一款基于大语言模型（LLM）驱动的 **1-bit 像素风全息系统文字冒险游戏（AVG/RPG）**。

玩家将作为"全息系统游戏"的第一批体验者，在随机生成的世界观（修仙、赛博、无限流等）和系统设定（好感度、万人迷、龙傲天等）中，体验高自由度的角色扮演。你的每一个选择都将直接影响世界走向，并在约 50 轮的交互后达成多重结局（S/A/B/C/隐藏结局）。

---

## 🌟 核心特性

- 🧠 **AI 动态推演**：摒弃传统文字游戏固定的预设脚本，完全由 LLM 扮演"001号系统"及所有 NPC，实时生成符合人设逻辑的剧情与任务。
- 🎭 **Roguelite 副本机制**：每次开局随机抽取世界观与系统外挂。单局控制在约 50 个回合左右，具备完整的起承转合与节奏控制。
- 🏆 **多结局与成就系统**：根据玩家通关时的表现判定结局评级。内置 SQLite 数据库，持久化记录通关数据，解锁成就并在「副本图鉴」中点亮世界。
- 📱 **极致的双端适配**：
  - **PC 宽屏**：硬核复古的 1-bit 像素风三栏布局（角色信息 / 故事流 / 系统面板）。
  - **移动端**：完美复刻 AVG 体验，长文本智能分页，隐藏冗余面板，点击屏幕即可翻页，选项延迟显现，沉浸感极强。
- 💾 **多用户与云存档**：支持 JWT 多用户注册登录，每个玩家拥有独立的冒险档案和 6 个云存档槽位。
- ⚡ **流式打字机体验**：使用 Server-Sent Events (SSE) 技术将大模型的输出实时流式推送到前端，支持所见即所得。

---

## 📸 界面预览

![PC端主界面预览](images/screen1.png)

- **PC端主界面**：经典的三栏像素窗口布局（角色信息 / 故事流 / 系统面板）。
- **移动端沉浸模式**：全屏阅读，点击翻页的专注体验。
- **结算与档案系统**：通关评级动画及玩家的冒险统计图鉴。

---

## 🛠️ 技术栈

- **前端**：Vanilla HTML / CSS / JS (零框架)，纯手写 1-bit 像素 UI 及媒体查询响应式布局。
- **后端**：Node.js + Express
- **数据库**：SQLite3（轻量级本地存储方案）
- **AI 接口**：兼容 **OpenAI API 格式** 的任意大语言模型接口（官方 OpenAI、DeepSeek、Kimi、智谱、SiliconFlow、OneAPI 中转、本地 Ollama/vLLM 等均可接入）

---

## 🚀 快速开始

### 1. 环境要求

- **Node.js** (v18 或更高版本)
- **npm** 或 **yarn**（Node.js 安装时会自带 npm）

> 不知道自己有没有安装？在终端输入以下命令检查：
> ```bash
> node -v
> npm -v
> ```
> 如果显示版本号（如 `v20.12.0`），说明已安装。如果没有，请先前往 [nodejs.org](https://nodejs.org/) 下载安装 LTS 版本。

---

### 2. 克隆项目到本地

打开终端（Windows 用户请使用 PowerShell 或 Git Bash），执行：

```bash
git clone https://github.com/ziyuan888/GenCompass.git
cd GenCompass
```

> 如果提示 `git: command not found`，请先安装 [Git](https://git-scm.com/downloads)。

---

### 3. 安装依赖

在项目根目录（也就是 `GenCompass` 文件夹内）执行：

```bash
npm install
```

这会读取 `package.json`，自动下载所有需要的 Node.js 模块到 `node_modules/` 文件夹中。第一次安装可能需要 1~3 分钟，取决于网络速度。

> 💡 如果安装过程中出现权限错误（如 `EACCES`），可以尝试：
> ```bash
> sudo npm install
> ```
> 或者参考 [npm 官方文档](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally) 修复权限。

---

### 4. 配置环境变量

本项目使用官方的 `openai` SDK 调用大模型，**兼容所有支持 OpenAI API 格式的平台**。你只需要配置接口地址、密钥和模型名即可，无需修改任何代码。

**步骤：**

1. 在项目根目录创建一个名为 `.env` 的文本文件：
   ```bash
   # macOS / Linux
   touch .env

   # Windows (PowerShell)
   New-Item .env
   ```

2. 用任意文本编辑器打开 `.env`，填入你的 API 配置：
   ```env
   API_KEY=sk-你的API密钥
   API_BASE_URL=https://api.openai.com/v1
   MODEL=gpt-4o
   ```

   > 🔑 **如何获取 API 密钥？**
   > - 如果你使用 **OpenAI 官方**，前往 [platform.openai.com](https://platform.openai.com/api-keys) 创建密钥。
   > - 如果你使用 **国内第三方平台**（DeepSeek、Kimi、智谱、SiliconFlow 等），请前往对应平台官网获取密钥。

3. **根据你的平台修改 `.env` 中的值**，常见示例如下：

   | 平台 | `.env` 配置示例 |
   |------|----------------|
   | **OpenAI 官方** | `API_KEY=sk-xxx`<br>`API_BASE_URL=https://api.openai.com/v1`<br>`MODEL=gpt-4o` |
   | **DeepSeek** | `API_KEY=sk-xxx`<br>`API_BASE_URL=https://api.deepseek.com/v1`<br>`MODEL=deepseek-chat` |
   | **Kimi (Moonshot)** | `API_KEY=sk-xxx`<br>`API_BASE_URL=https://api.moonshot.cn/v1`<br>`MODEL=moonshot-v1-8k` |
   | **智谱 AI (GLM)** | `API_KEY=xxx`<br>`API_BASE_URL=https://open.bigmodel.cn/api/paas/v4`<br>`MODEL=glm-4` |
   | **SiliconFlow** | `API_KEY=sk-xxx`<br>`API_BASE_URL=https://api.siliconflow.cn/v1`<br>`MODEL=deepseek-ai/DeepSeek-V3` |
   | **OneAPI / NewAPI 中转** | `API_KEY=sk-xxx`<br>`API_BASE_URL=https://你的中转地址/v1`<br>`MODEL=你配置的模型名` |
   | **本地 Ollama** | `API_KEY=ollama`<br>`API_BASE_URL=http://localhost:11434/v1`<br>`MODEL=qwen2.5:7b` |

   > ⚠️ **前提条件**：所选平台必须支持**流式输出**（`stream: true`），因为前端使用 SSE 实时推送内容。绝大多数主流平台均支持。

---

### 5. 启动服务

```bash
npm run dev
```

如果看到类似下面的输出，说明启动成功：

```
> gencompass@1.0.0 dev
> node server.js

Server running on http://localhost:3000
```

> 💡 如果端口 `3000` 被占用，可以在 `server.js` 中修改端口号，或者设置环境变量：
> ```bash
> PORT=8080 npm run dev
> ```

---

### 6. 打开游戏

在浏览器中访问：

```
http://localhost:3000
```

推荐使用 **Chrome**、**Edge** 或 **Firefox** 浏览器以获得最佳体验。

---

## 📂 目录结构

```text
├── data/                  # SQLite 数据库及存档 JSON 存储目录
│   └── users.db           # (自动生成) 用户账号与成就记录
├── docs/
│   └── prompt.txt         # 核心 System Prompt (AI 调教指北)
├── public/                # 纯前端静态资源
│   ├── index.html         # 单页应用入口
│   ├── style.css          # 全局样式与响应式媒体查询
│   └── app.js             # 客户端交互逻辑、流式解析与分页算法
├── server.js              # 后端 Express 主服务 (路由、SSE 流、数据库)
└── package.json           # 项目依赖
```

---

## 🕹️ 玩法指南

1. **注册登录**：使用任意用户名和密码注册进入游戏系统。
2. **开始新局**：系统会随机为你抽取副本世界观。如果遇到不满意的，可以重新开始刷初始。
3. **行动选择**：每一回合，系统会给出当前环境的描述和 3 个建议选项。你可以选择其中之一，或者在输入框中**自行输入**天马行空的举动。
4. **达成结局**：完成系统颁布的【长期任务】或【限时任务】，并推动剧情发展。在约 50 轮内迎来高潮并结算评价。
5. **点亮图鉴**：在主菜单的「冒险档案」中查看你的总评级，在「副本图鉴」中收集不同世界观与系统类型的通关记录。

---

## 📝 贡献与许可

本项目属于开源爱好者练习与探索大模型在 AVG 游戏应用潜力的项目。
你可以随意 Fork，修改 Prompt 词来打造属于你的世界观引擎。

基于 [MIT License](LICENSE) 开源。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=XucroYuri/GenCompass&type=Date)](https://star-history.com/#XucroYuri/GenCompass&Date)

## 支持项目

<!-- SUPPORT-PROJECT:START -->
如果这个项目对你有帮助，可以自愿赞赏支持后续维护。赞赏不是付费咨询服务，也不构成任何结果承诺；请不要在转账备注中填写姓名、手机号、证件号等敏感信息。

<p align="center">
  <img src="https://raw.githubusercontent.com/XucroYuri/lever-gaokao/main/docs/assets/sponsor/alipay-card.png" alt="支付宝赞助二维码" width="260">
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="https://raw.githubusercontent.com/XucroYuri/lever-gaokao/main/docs/assets/sponsor/wechat-reward-card.png" alt="微信赞赏二维码" width="260">
</p>

<p align="center"><strong>时不我待，功不唐捐</strong></p>
<!-- SUPPORT-PROJECT:END -->
