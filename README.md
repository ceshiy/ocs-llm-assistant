# OCS LLM 答题助手

基于大语言模型（Large Language Model，LLM）的网课答题助手，支持文字题和图片题。项目包含油猴脚本和服务端代理两部分：客户端提交题目，服务端处理图片并调用模型。

> 初次使用请阅读[使用教程](docs/使用教程.md)。教程覆盖安装 Tampermonkey、导入脚本、配置题库和开始答题。

## 术语

- **API**（Application Programming Interface，应用程序编程接口）：客户端与服务端、服务端与模型服务之间的调用接口。
- **OCS**（Online Course Script，网课助手）：本项目配套的油猴脚本。
- **JSON**（JavaScript Object Notation，JavaScript 对象表示法）：题库配置和接口数据的格式。
- **CORS**（Cross-Origin Resource Sharing，跨域资源共享）：浏览器允许网页跨域访问服务端的机制。

## 重要说明

- 本项目已适配 OCS 5.2.7，并支持 OCS 5.1 及以上版本的图片题优化协议。旧版 OCS 可以使用服务端抓图方式处理图片。
- 项目仅在学习通平台测试过。智慧树、学堂在线等平台尚未测试，不保证可用。
- 图片题需要模型和 API 服务同时支持图片输入。可以通过 `LLM_VISION_MODEL` 指定图片题模型；留空时使用 `LLM_MODEL`。
- 模型回答可能出错，请自行核对答案。

## 功能特性

- 支持单选题、多选题、判断题、填空题和简答题。
- 支持图片题：
  - OCS 5.1 及以上版本支持浏览器转换图片并上传 Base64 数据。
  - 旧版 OCS 或关闭图片题优化时，服务端会下载图片并添加白色背景后处理。
- 使用服务端代理调用模型，API Key 不直接暴露给客户端。
- 兼容 OpenAI Chat Completions 格式的 API。
- 支持通过 Docker 部署。

## 快速开始

### 1. 准备服务端配置

进入 `server` 目录，并复制环境变量模板：

```bash
cd server
cp .env.example .env
```

编辑 `.env`，以 DeepSeek 官方 API 为例：

```dotenv
LLM_API_URL=https://api.deepseek.com/v1/chat/completions
LLM_API_KEY=your-api-key
LLM_MODEL=deepseek-flash
LLM_VISION_MODEL=
SERVER_BASE_URL=http://localhost:3000
```

将 `your-api-key` 替换为实际的 API Key。`LLM_VISION_MODEL` 留空时，图片题使用 `LLM_MODEL`。上述示例中的 `deepseek-flash` 支持图片输入。

如果 OCS 与服务端不在同一台设备上，请将 `SERVER_BASE_URL` 改为浏览器能够访问的服务地址。

使用其他服务商时，需要同时修改 API 地址、API Key 和模型 ID。图片题还需要确认所选模型及接入接口支持图片输入。

### 2. 启动服务端

**方式一：使用 Node.js**

```bash
npm install
npm start
```

**方式二：使用 Docker**

```bash
docker build -t ocs-llm-proxy .
docker run -d -p 3000:3000 --env-file .env --name ocs-proxy ocs-llm-proxy
```

启动后，可访问 `http://localhost:3000/health` 检查服务是否可访问。如果服务部署在其他设备上，请将地址替换为实际服务地址。

### 3. 安装油猴脚本

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展。
2. 任选一个版本导入，二者只安装一个：
   - **标准版** `OCS 网课助手-5.2.7.js`：自建题库需要在脚本头部的 `@connect` 中加入域名或公网地址。
   - **全域名通用版** `OCS 网课助手-5.2.7-全域名通用版.js`：已内置 `// @connect *`，可以连接任意自建域名或公网地址，无需修改脚本。
3. 保存并启用脚本。

### 4. 配置题库

1. 使用标准版时，在油猴脚本头部的 `@connect` 中加入服务端域名或公网地址。例如：

   ```javascript
   // @connect ocs.example.com
   ```

   否则，`GM_xmlhttpRequest` 可能被拦截。使用全域名通用版时，可以跳过这一步。

2. 访问服务端的 `GET /api/config` 接口，获取完整的题库配置。例如，本机默认地址为：

   ```text
   http://localhost:3000/api/config
   ```

3. 将返回的配置复制到 OCS 的题库设置中。

OCS 5.1 及以上版本启用图片题优化后，客户端会提交图片信息。配置通过 `${suggestion_title}`、`${suggestion_options}` 和 `images` 字段传递这些信息。旧版 OCS 或关闭图片题优化时，服务端会从题干和选项中的图片地址下载图片。

> 如果使用响应较慢的推理模型，请在 OCS 设置中将“搜题最大耗时”调整到 60 秒以上，避免客户端提前超时。

## 支持的 LLM

本项目通过 **OpenAI Chat Completions 兼容接口**调用模型。

### 接入条件

选择模型时，请确认：

1. API 服务支持 Chat Completions 请求和响应格式。
2. 模型 ID 可以通过配置的 API 地址和 API Key 调用。
3. 如果需要处理图片题，模型和接入服务都支持通过兼容接口接收 Base64 图片。
4. 如果文字题和图片题使用不同模型，两个模型都需要能通过同一个 `LLM_API_URL` 和 `LLM_API_KEY` 调用。

符合上述条件的服务可以接入。常见服务包括 DeepSeek、通义千问、GLM、Kimi、豆包、MiMo、MiniMax、Step、SenseNova、LongCat、OpenAI、Claude 和 Gemini 等，也包括兼容网关。具体支持情况取决于所选模型和接入方式。

### 模型示例

以下示例的图片输入能力来自厂商官方文档，**不代表本项目已逐一测试**。模型 ID、可用区域和调用权限可能变化，请以实际服务商的文档为准。

| 服务商或接入方式 | 模型 ID 示例 | 官方资料 |
| --- | --- | --- |
| DeepSeek 官方 API | `deepseek-flash` | [图片输入文档](https://api-docs.deepseek.com/guides/vision/) |
| 阿里云百炼 | `qwen3.8-max` | [图像理解文档](https://help.aliyun.com/zh/model-studio/vision/) |
| OpenAI API | `gpt-5.4` | [模型文档](https://developers.openai.com/api/docs/models/gpt-5.4) |
| Gemini API 的 OpenAI 兼容接口 | `gemini-3.8-flash` | [兼容接口文档](https://ai.google.dev/gemini-api/docs/openai) |

以上示例均有厂商文档说明图片输入能力。第三方中转服务可能使用不同的模型 ID，也可能限制图片输入，请以中转服务的实际配置为准。

## 环境变量说明

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `LLM_API_URL` | Chat Completions 接口的完整地址 | `https://api.deepseek.com/v1/chat/completions` |
| `LLM_API_KEY` | 模型服务的 API Key，必填 | 无 |
| `LLM_MODEL` | 文字题使用的模型 ID | `deepseek-flash` |
| `LLM_VISION_MODEL` | 图片题使用的模型 ID；留空时使用 `LLM_MODEL` | 留空 |
| `LLM_MAX_TOKENS` | 模型输出的最大 Token 数；`0` 表示项目不设置额外上限 | `0` |
| `PORT` | 服务端监听端口 | `3000` |
| `SERVER_BASE_URL` | 浏览器访问服务端的地址 | `http://localhost:3000` |
| `ALLOWED_ORIGINS` | CORS 允许的来源 | `*` |
| `JSON_LIMIT` | JSON 请求体大小限制 | `15mb` |

> DeepSeek 官方已下线旧版本默认的 `deepseek-chat`（[公告](https://api-docs.deepseek.com/news/news260424/)）。当前版本默认使用 `deepseek-flash`。如果你使用旧版 `.env`，请显式修改 `LLM_MODEL`。
>
> `LLM_MAX_TOKENS` 设置过小可能导致回答被截断。即使设为 `0`，模型输出仍受服务商的限制。

## API 接口

### `GET /health`

健康检查接口。

### `GET /api/config`

获取 OCS 自定义题库配置。

### `HEAD /api/proxy` 和 `GET /api/proxy`

题库状态检测接口，返回状态码 `200`。

OCS 5.x 会先发送 `HEAD` 请求；如果收到 `405` 或 `501`，则回退到 `GET`。实际答题请求使用 `POST`。

### `POST /api/proxy`

提交题目并获取答案。

**请求示例：**

```json
{
  "question": "1 + 1 等于多少？",
  "options": "A. 2\nB. 3",
  "type": "single"
}
```

**请求字段：**

| 字段 | 说明 |
| --- | --- |
| `question` | 题目内容 |
| `options` | 选项内容 |
| `type` | 题型：`single`、`multiple`、`judgement` 或 `completion` |
| `suggestion_title` | 可选，图片地址替换为 `[图片N]` 后的题干 |
| `suggestion_options` | 可选，图片地址替换为 `[图片N]` 后的选项 |
| `images` | 可选，浏览器转换后的 Base64 图片数组 |

**响应示例：**

```json
{
  "answer": "A"
}
```

## 项目结构

```text
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

## 版本记录

| 版本 | 说明 |
| --- | --- |
| `v1.0.1` | 修复题库健康检查误报；新增全域名通用版脚本；更新安装文档。 |
| `v1.0.0` | 适配 OCS 5.2.7；支持 5.1+ 图片题 Base64 直传；发布使用教程。 |

## License

本项目采用 MIT 许可证。
