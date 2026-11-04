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
- 兼容 OpenAI Chat Completions 格式 API（DeepSeek、Qwen、GLM、Kimi、豆包、MiMo、MiniMax、Step、SenseNova、LongCat 等，以及 OpenAI / Claude / Gemini 兼容网关）
- Docker 一键部署

## 项目结构

```
。
├── OCS 网课助手-5.2.7.js   # 油猴脚本（标准版）
├── OCS 网课助手-5.2.7-全域名通用版.js  # 油猴脚本（@connect *，任意自建域名）
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
2. 任选一个版本导入（二选一，不要同时启用）：
   - **标准版** `OCS 网课助手-5.2.7.js`：自建题库需手动在脚本头部 `@connect` 中加入你的域名或 IP
   - **全域名通用版** `OCS 网课助手-5.2.7-全域名通用版.js`：已内置 `// @connect *`，可连接任意自建域名/IP，无需修改脚本
3. 保存并启用

### 3. 配置题库

在 OCS 脚本的题库设置中，添加自定义题库，配置指向你的服务端地址：

- 自建服务需要先在油猴脚本头部的 `@connect` 中加入你的域名或公网 IP（如 `// @connect ocs.example.com`），否则 `GM_xmlhttpRequest` 会被拦截，详见 [使用教程](docs/使用教程.md)；不想改脚本可直接使用「全域名通用版」（已内置 `// @connect *`），但脚本会获得访问任意域名的权限，请仅使用可信来源；
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

### HEAD / GET /api/proxy

题库状态检测接口，返回 `200`。OCS 5.x 会先发 `HEAD` 探测，遇到 `405/501` 时回退 `GET`；实际答题仍使用 `POST`。

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

任何兼容 OpenAI Chat Completions 格式的 API 均可使用。以下模型默认按支持文本题和图片题（多模态）收录，实际是否开放视觉输入以模型厂商或中转服务为准。

### 近两个月（2026 年 9 月 – 11 月初）

#### 2026 年 10 月

| 模型 | 发布时间 |
|------|----------|
| 商汤 SenseNova Loop-9B-Preview | 10 月 30 日 |
| Gemini 4 Carbon | 10 月 28–29 日 |
| Kimi K3.1 Pro / Highspeed | 10 月 24 日 |
| MiniMax M3.1 Flash | 10 月 19 日 |
| DeepSeek V4.1 Flash 1017 | 10 月 17 日 |
| Meta Muse Wonder / Muse Wonder Full | 10 月 13 日 |

#### 2026 年 9 月

| 模型 | 发布时间 |
|------|----------|
| Gemini 4 Argon | 9 月 30 日 |
| GPT-6.1 Sol | 9 月 29 日 |
| Claude Sonnet 5.5 | 9 月 28 日 |
| Claude Opus 5.5 | 9 月 22 日 |
| GPT-6 Sol / Luna | 9 月 22 日 |
| 小米 MiMo-V2.6 系列（Pro / Flash / Pro-UltraSpeed / Distill-Qwen-9B） | 9 月 22 日 |
| Step 5 Preview（阶跃星辰） | 9 月 20 日 |
| GLM-5.3-FlashX（智谱） | 9 月 18 日 |
| Xing4.0-29B-A4B（中国电信） | 9 月 17 日 |
| Gemini 3.8 Live / Live Extended Thinking | 9 月 15 日 |
| Grok 4.7（xAI） | 9 月 12 日 |
| DeepSeek V4.1-Flash | 9 月 10 日 |
| 讯飞星火 X2.5 | 9 月 7 日 |
| GPT-6 Astra | 9 月 3 日 |
| Gemini 3.8 Flash / Flash Cyber | 9 月 2 日 |
| Claude Fable 5.1 / Mythos 5.1 | 9 月 1 日 |
| Qwen3.8-Omni-Flash / Qwen3.8-LiveTranslate（阿里） | 9 月 |
| Qwen3.8-Max-0902（阿里） | 9 月 |

### 此前已收录的型号

- Claude Opus 5.5 / Claude Mythos 5.5 / Fable 5.5
- GPT-6 Astra / GPT-6.2 Astra / GPT-6 Luna
- Gemini 4 Carbon
- DeepSeek V4.1 Flash 1017
- 智谱 GLM-5.3 Flash
- 腾讯 Hy4 preview
- MiniMax M3.1 Flash
- Kimi K3.1 Pro
- 阿里 Qwen3.7 Max / Qwen3.8 Flash
- 美团 LongCat-2.5
- 小米 MiMo-V2.6 系列

> 更早的 GPT-4o、DeepSeek V3、Claude 4.x、Gemini 2.5 等型号，只要兼容 OpenAI Chat Completions 格式并支持 vision，仍可正常使用。

## License

MIT
