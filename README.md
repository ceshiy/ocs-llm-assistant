# OCS LLM 答题助手

基于 LLM 的网课答题助手，支持文字题和图片题。包含油猴脚本和服务端代理两部分。

## 功能特性

- 支持单选题、多选题、判断题、填空题
- 支持图片题（自动下载图片并加白色背景处理）
- 服务端代理模式，API Key 不暴露给客户端
- 兼容 OpenAI 格式 API（DeepSeek、mimo 等）
- Docker 一键部署

## 项目结构

```
.
├── OCS 网课助手-4.13.19.js   # 油猴脚本（客户端）
├── OCS-LLM-题库配置.json      # 题库配置示例
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
2. 在 Tampermonkey 中新建脚本，粘贴 `OCS 网课助手-4.13.19.js` 的内容
3. 保存并启用

### 3. 配置题库

在 OCS 脚本的题库设置中，添加自定义题库，配置指向你的服务端地址。

## 环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LLM_API_URL` | LLM API 地址 | `https://api.deepseek.com/v1/chat/completions` |
| `LLM_API_KEY` | API Key（必填） | - |
| `LLM_MODEL` | 文字题模型 | `deepseek-chat` |
| `LLM_VISION_MODEL` | 图片题模型（为空则用 LLM_MODEL） | - |
| `LLM_MAX_TOKENS` | 最大 token 数（0=不限制） | `0` |
| `PORT` | 服务端口 | `3000` |
| `SERVER_BASE_URL` | 服务外网地址 | `http://localhost:3000` |
| `ALLOWED_ORIGINS` | CORS 允许的来源 | `*` |
| `JSON_LIMIT` | 请求体大小限制 | `15mb` |

## API 接口

### GET /health

健康检查。

### GET /api/config

获取题库配置（供油猴脚本使用）。

### POST /api/proxy

代理答题接口。

**请求体：**
```json
{
  "question": "题目内容",
  "options": "选项内容",
  "type": "single|multiple|judgement|completion"
}
```

**响应：**
```json
{
  "answer": "A"
}
```

## 支持的 LLM

任何兼容 OpenAI Chat Completions 格式的 API 均可使用：

- DeepSeek
- mimo（支持 vision）
- OpenAI
- 其他 OpenAI 兼容服务

## License

MIT
