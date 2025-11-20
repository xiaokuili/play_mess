# 演进式架构师 (Evolutionary Architect)

一个基于 Next.js 和 AI 的架构演进工具，帮助您从需求出发，逐步演进系统架构。

## 功能特性

- 🤖 **AI 驱动的架构演进**: 基于提示词工程，AI 自动生成架构演进方案
- 📊 **可视化展示**: 使用 Excalidraw 实时展示架构演进过程
- 💬 **交互式聊天**: 通过自然语言输入需求，AI 生成多轮架构演进方案
- 🔄 **多轮演进**: 支持查看每一轮的架构变化和问题追踪

## 技术栈

- **前端**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **可视化**: Excalidraw
- **后端**: Next.js API Routes
- **AI**: 支持 OpenAI API 或 Anthropic API

## 项目结构

```
architecture-evolution/
├── app/
│   ├── api/
│   │   └── architect/        # 架构演进 API 路由
│   ├── layout.tsx            # 根布局
│   └── page.tsx              # 主页面（SPA）
├── components/
│   ├── ChatPanel.tsx         # 左侧聊天面板
│   └── ExcalidrawPanel.tsx   # 右侧 Excalidraw 展示面板
├── lib/
│   ├── architecture-to-excalidraw.ts  # 架构数据转 Excalidraw 转换器
│   └── prompt.ts             # AI 提示词
└── ...
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local` 并配置你的 LLM API Key:

```bash
cp .env.example .env.local
```

编辑 `.env.local`:

```env
# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_API_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-4

# 或者使用 Anthropic API
# ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

**注意**: 如果没有配置 API Key，系统会使用模拟数据（用于测试）。

### 3. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 使用说明

### 输入需求

在左侧聊天面板输入你的架构需求，例如：

- "构建一个支持 10万 QPS 的即时通讯系统"
- "设计一个电商平台的微服务架构"
- "实现一个高可用的消息队列系统"

### 查看演进过程

1. AI 会生成多轮架构演进方案（默认 3 轮）
2. 点击顶部的轮次按钮切换查看不同阶段的架构
3. 右侧 Excalidraw 画布会实时更新显示当前轮次的架构图
4. 底部显示已解决的问题和新发现的问题

### 架构图说明

- **绿色节点**: 新增组件 (new)
- **橙色节点**: 修改的组件 (modified)
- **灰色节点**: 稳定组件 (stable)
- **实线箭头**: 同步交互 (sync)
- **虚线箭头**: 异步交互 (async)

## SSR vs SPA

本项目采用 Next.js App Router，主页面 (`app/page.tsx`) 使用 `'use client'` 标记为客户端组件，实现 SPA 体验：

- **SSR**: 用于初始页面加载和 SEO
- **SPA**: 用于交互式功能（聊天、图表展示）

Excalidraw 组件使用 `dynamic` 导入，避免 SSR 问题。

## 开发

### 项目结构说明

- `lib/architecture-to-excalidraw.ts`: 将架构数据转换为 Excalidraw JSON 格式
- `lib/prompt.ts`: AI 提示词模板
- `app/api/architect/route.ts`: 后端 API，调用 LLM 生成架构演进方案
- `components/ChatPanel.tsx`: 聊天界面组件
- `components/ExcalidrawPanel.tsx`: Excalidraw 展示组件

### 自定义提示词

编辑 `lib/prompt.ts` 可以修改 AI 的行为和输出格式。

### 自定义样式

架构图的样式配置在 `lib/architecture-to-excalidraw.ts` 的 `StyleConfig` 类中。

## 注意事项

1. **API Key 安全**: 不要将 `.env.local` 提交到版本控制系统
2. **API 费用**: 使用 LLM API 会产生费用，请注意控制使用量
3. **Node 版本**: 推荐使用 Node.js 20.9.0 或更高版本

## License

MIT
