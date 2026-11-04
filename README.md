# OCS LLM 答题助手

基于 LLM 的网课答题助手，支持文字题和图片题。包含油猴脚本和服务端代理两部分

> 新手请先阅读 [使用教程](docs/使用教程.md)：从安装 Tampermonkey 到导入脚本、配置题库和开始答题。

## 重要说明

> **主流大模型已普遍支持多模态（图片识别）。** 图片题建议单独配置 `LLM_VISION_MODEL`（留空则复用 `LLM_MODEL`），并确认所用模型及中转/代理服务确实开放了视觉输入；少数纯文本模型或关闭了视觉能力的第三方 API 仍可能导致图片无法识别
>
> 回答正确与否完全取决于大模型的能力，与本项目无关。本项目仅提供代理转发和图片处理能力
>
> 本项目仅在学习通平台测试，智慧树、学堂在线等其他平台未作测试，不保证可用性
>
> 已适配 OCS 5.2.7（含 5.1+ 图片题优化协议），旧版 OCS 仍可用并自动回退到服务端抓图

## 功能特性

- 支持单选题、多选题、判断题、填空题
- 支持图片题（OCS 5.1+ 浏览器端 base64 直传；旧版自动下载并加白色背景处理）
- 服务端代理模式，API Key 不暴露给客户端
- 兼容 OpenAI Chat Completions 格式 API（DeepSeek、Qwen、GLM、Kimi、豆包、MiMo，以及 OpenAI / Claude / Gemini 兼容网关）
- Docker 一键部署

## 项目结构

```
。
├── OCS 网课助手-5.2.7.js   # 油猴脚本（客户端）
└── server/                     # 服务端代理
    ├── server.js               # 主服务
    ├── server-utils.js         # 工具函数
    ├── package.json
    ├── Dockerfile
    ├── .env.example            # 环境变量模板
    └── .gitignore
```

## 快速开始

### 1. 部署服务端

#### 方式一：Node.js 直接运行

```bash
cd server
cp .env.example .env
# 编辑 .env，填入你的 LLM API Key
npm install
npm start
```

#### 方式二：Docker 部署

```bash
cd server
cp .env.example .env
# 编辑 .env，填入你的 LLM API Key
docker build -t ocs-llm-proxy .
docker run -d -p 3000:3000 --env-file .env --name ocs-proxy ocs-llm-proxy
```

### 2. 安装油猴脚本

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 在 Tampermonkey 中新建脚本，粘贴 `OCS 网课助手-5.2.7.js` 的内容
3. 保存并启用

### 3. 配置题库

在 OCS 脚本的题库设置中，添加自定义题库，配置指向你的服务端地址：

- 直接访问 `GET /api/config` 获取完整题库配置，复制到 OCS 的题库配置中；
- OCS 5.1+ 图片题优化：配置通过 `${suggestion_title}`、`${suggestion_options}` 和 `images` 字段提交浏览器端已转换的 base64 图片，服务端不再重复下载；
- 旧版 OCS 或关闭图片题优化时，`title` / `options` 中的图片 URL 仍由服务端下载并处理。

> 如果使用响应较慢的推理模型，请在 OCS 设置中把“搜题最大耗时”调整到 60 秒以上，避免客户端先超时。

## 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LLM_API_URL` | LLM API 地址 | `https://api.deepseek.com/v1/chat/completions` |
| `LLM_API_KEY` | API Key（必填） | - |
| `LLM_MODEL` | 文字题模型 | `deepseek-chat` |
| `LLM_VISION_MODEL` | 图片题模型（留空则复用 `LLM_MODEL`） | - |
| `LLM_MAX_TOKENS` | 最大 token 数（0=不限制） | `0` |
| `PORT` | 服务端口 | `3000` |
| `SERVER_BASE_URL` | 服务外网地址 | `http://localhost:3000` |
| `ALLOWED_ORIGINS` | CORS 允许的来源 | `*` |
| `JSON_LIMIT` | 请求体大小限制 | `15mb` |

> **注意：**
> - `LLM_VISION_MODEL` 建议配置为支持多模态的模型；留空时使用 `LLM_MODEL`。请确认所用模型和中转服务实际开放了视觉输入
> - `LLM_MAX_TOKENS` 设置过小会导致大模型回答被截断，答案无法解析。默认为 0（不限制），如有需要请自行修改

## API 接口

### GET /health

健康检查

### GET /api/config

获取题库配置（供油猴脚本使用）

### POST /api/proxy

代理答题接口

**请求体：**
```json
{
  "question": "题目内容",
  "options": "选项内容",
  "type": "single|multiple|judgement|completion",
  "suggestion_title": "可选：图片 URL 替换为 [图片N] 后的题干",
  "suggestion_options": "可选：图片 URL 替换为 [图片N] 后的选项",
  "images": ["data:image/png;base64,..."]
}
```

**响应：**
```json
{
  "answer": "A"
}
```

## 支持的 LLM

任何兼容 OpenAI Chat Completions 格式的 API 均可使用。下表列出当前主流模型系列（以各厂商最新版本为准）：

| 模型系列 | 纯文字题 | 图片题 | 备注 |
|----------|----------|--------|------|
| DeepSeek V4 / V4.1（含 Flash） | 支持 | 支持 | 以所用 API 是否开放视觉输入为准 |
| OpenAI GPT-5 / GPT-4o 系列 | 支持 | 支持 | |
| Anthropic Claude 4.x 系列 | 支持 | 支持 | 通过 OpenAI 兼容网关接入 |
| Google Gemini 2.5 / 3 系列 | 支持 | 支持 | 通过 OpenAI 兼容网关接入 |
| 通义千问 Qwen3-VL 系列 | 支持 | 支持 | |
| 智谱 GLM-4.xV 系列 | 支持 | 支持 | |
| 月之暗面 Kimi 多模态系列 | 支持 | 支持 | 以具体版本为准 |
| 字节豆包 Doubao 多模态系列 | 支持 | 支持 | |
| 小米 MiMo-VL | 支持 | 支持 | |
| xAI Grok 4 系列 | 支持 | 支持 | 通过 OpenAI 兼容网关接入 |
| 其他 OpenAI 兼容服务 | 视模型而定 | 需支持 vision | 以服务商文档为准 |

## License

MIT
