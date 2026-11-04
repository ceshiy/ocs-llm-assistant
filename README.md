# OCS LLM 答题助手

基于大语言模型的网课答题助手，支持文字题和图片题。项目包含油猴脚本和服务端代理两部分。

> 初次使用请阅读[使用教程](docs/使用教程.md)。教程覆盖安装 Tampermonkey、导入脚本、配置题库和开始答题。

## 术语

- **LLM**（Large Language Model，大语言模型）：提供答题能力的大模型服务。
- **API**（Application Programming Interface，应用程序编程接口）：客户端与服务端、服务端与模型服务之间的调用接口。
- **OCS**（Online Course Script，网课助手）：本项目配套的油猴脚本。
- **JSON**（JavaScript Object Notation，JavaScript 对象表示法）：题库配置和接口数据的格式。
- **CORS**（Cross-Origin Resource Sharing，跨域资源共享）：浏览器允许网页跨域访问服务端的机制。

## 重要说明

> **主流大模型已普遍支持多模态。** 图片题建议单独配置 `LLM_VISION_MODEL`。该变量留空时复用 `LLM_MODEL`。
>
> 请确认所用模型和中转服务确实开放视觉输入。少数纯文本模型可能无法识别图片。关闭视觉能力的第三方 API 也有同样问题。
>
> 回答是否正确取决于大模型能力，与本项目无关。本项目只负责代理转发和图片处理。
>
> 本项目仅在学习通平台测试。智慧树、学堂在线等其他平台未做测试，不保证可用。
>
> 已适配 OCS 5.2.7，包含 5.1+ 图片题优化协议。旧版 OCS 仍可使用，并自动回退到服务端抓图。

## 功能特性

- 支持单选题、多选题、判断题、填空题和简答题。
- 支持图片题。OCS 5.1+ 在浏览器端把图片转换成 Base64 后直接提交。旧版 OCS 中，服务端下载图片并添加白色背景后处理。
- 采用服务端代理模式。API Key 只保存在服务端，客户端不接触密钥。
- 兼容 OpenAI Chat Completions 格式的 API。
- 支持 DeepSeek、Qwen、GLM、Kimi、豆包、MiMo、MiniMax、Step、SenseNova、LongCat 等模型。
- 支持 OpenAI、Claude 和 Gemini 兼容网关。
- 支持 Docker 一键部署。

## 项目结构

```
.
├── OCS 网课助手-5.2.7.js              # 油猴脚本（标准版）
├── OCS 网课助手-5.2.7-全域名通用版.js  # 油猴脚本（@connect *，任意自建域名）
└── server/                             # 服务端代理
    ├── server.js                       # 主服务
    ├── server-utils.js                 # 工具函数
    ├── package.json
    ├── Dockerfile
    ├── .env.example                    # 环境变量模板
    └── .gitignore
```

## 快速开始

### 部署服务端

**方式一：使用 Node.js 直接运行**

```bash
cd server
cp .env.example .env
# 编辑 .env，填入你的 LLM API Key
npm install
npm start
```

**方式二：使用 Docker 部署**

```bash
cd server
cp .env.example .env
# 编辑 .env，填入你的 LLM API Key
docker build -t ocs-llm-proxy .
docker run -d -p 3000:3000 --env-file .env --name ocs-proxy ocs-llm-proxy
```

### 安装油猴脚本

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展。
2. 任选一个版本导入，二者只安装一个：
   - **标准版** `OCS 网课助手-5.2.7.js`：自建题库需要在脚本头部的 `@connect` 中加入域名或公网地址。
   - **全域名通用版** `OCS 网课助手-5.2.7-全域名通用版.js`：已内置 `// @connect *`，可以连接任意自建域名或公网地址，无需修改脚本。
3. 保存并启用脚本。

### 配置题库

在 OCS 的题库设置中添加自定义题库，并将接口指向你的服务端：

- **标准版**：在脚本头部 `@connect` 中加入域名或公网地址。例如 `// @connect ocs.example.com`。否则 Tampermonkey 会拦截 `GM_xmlhttpRequest` 请求。详细步骤见[使用教程](docs/使用教程.md)。
- **全域名通用版**：无需修改 `@connect`。该版本允许脚本访问任意域名，请只在信任脚本来源时使用。
- 访问 `GET /api/config` 获取完整的题库配置，然后复制到 OCS 的题库配置中。
- OCS 5.1+ 支持图片题优化。客户端通过 `${suggestion_title}`、`${suggestion_options}` 和 `images` 字段提交图片。浏览器端会把图片转换为 Base64。服务端不再重复下载。
- 旧版 OCS 或关闭图片题优化时，图片地址仍保留在 `title` 和 `options` 中。服务端会下载并处理这些图片。

> 如果使用响应较慢的推理模型，请在 OCS 设置中把“搜题最大耗时”调整到 60 秒以上。这样可以避免客户端先超时。

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `LLM_API_URL` | 模型 API 地址 | `https://api.deepseek.com/v1/chat/completions` |
| `LLM_API_KEY` | 模型 API 密钥，必填 | - |
| `LLM_MODEL` | 文字题模型 | `deepseek-chat` |
| `LLM_VISION_MODEL` | 图片题模型，留空时复用 `LLM_MODEL` | - |
| `LLM_MAX_TOKENS` | 最大 Token 数，0 表示不限制 | `0` |
| `PORT` | 服务端口 | `3000` |
| `SERVER_BASE_URL` | 服务外网地址 | `http://localhost:3000` |
| `ALLOWED_ORIGINS` | CORS 允许的来源 | `*` |
| `JSON_LIMIT` | 请求体大小限制 | `15mb` |

> **注意**
>
> - `LLM_VISION_MODEL` 应配置为支持多模态的模型。留空时使用 `LLM_MODEL`。请确认模型和中转服务确实开放视觉输入。
> - `LLM_MAX_TOKENS` 过小会导致回答不完整，答案无法解析。默认值为 0，表示不限制。

## API 接口

### GET /health

健康检查接口。

### GET /api/config

获取题库配置，供油猴脚本和手动配置使用。

### HEAD / GET /api/proxy

题库状态检测接口，返回 `200`。OCS 5.x 打开题库配置时先发送 `HEAD` 请求。服务端返回 `405` 或 `501` 时，OCS 会回退到 `GET`。实际答题仍使用 `POST`。

### POST /api/proxy

代理答题接口。

请求体：

```json
{
  "question": "题目内容",
  "options": "选项内容",
  "type": "single|multiple|judgement|completion",
  "suggestion_title": "可选：图片地址替换为 [图片N] 后的题干",
  "suggestion_options": "可选：图片地址替换为 [图片N] 后的选项",
  "images": ["data:image/png;base64,<Base64 数据>"]
}
```

响应：

```json
{
  "answer": "A"
}
```

## 支持的 LLM

任何兼容 OpenAI Chat Completions 格式的 API 均可使用。下表所列模型默认支持文本题和图片题（多模态）。实际视觉输入能力以模型厂商或中转服务为准。

### 2026 年 10 月

| 模型 | 发布时间 |
| --- | --- |
| 商汤 SenseNova Loop-9B-Preview | 10 月 30 日 |
| Gemini 4 Carbon | 10 月 28 日~29 日 |
| Kimi K3.1 Pro / Highspeed | 10 月 24 日 |
| MiniMax M3.1 Flash | 10 月 19 日 |
| DeepSeek V4.1 Flash 1017 | 10 月 17 日 |
| Meta Muse Wonder / Muse Wonder Full | 10 月 13 日 |

### 2026 年 9 月

| 模型 | 发布时间 |
| --- | --- |
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

### 更早收录的模型

- Claude Opus 5.5、Claude Mythos 5.5 和 Claude Fable 5.5
- GPT-6 Astra、GPT-6.2 Astra 和 GPT-6 Luna
- Gemini 4 Carbon
- DeepSeek V4.1 Flash 1017
- 智谱 GLM-5.3 Flash
- 腾讯 Hy4 Preview
- MiniMax M3.1 Flash
- Kimi K3.1 Pro
- 阿里 Qwen3.7 Max 和 Qwen3.8 Flash
- 美团 LongCat-2.5
- 小米 MiMo-V2.6 系列

> 更早的 GPT-4o、DeepSeek V3、Claude 4.x、Gemini 2.5 等模型仍可使用。前提是兼容 OpenAI Chat Completions 格式，并支持视觉输入。

## 版本记录

| 版本 | 说明 |
| --- | --- |
| `v1.0.1` | 修复题库健康检查误报；新增全域名通用版脚本；更新安装文档。 |
| `v1.0.0` | 适配 OCS 5.2.7；支持 5.1+ 图片题 Base64 直传；发布使用教程。 |

## License

本项目采用 MIT 许可证。
