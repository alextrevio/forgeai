# ForgeAI API Reference

Base URL: `http://localhost:8000/api`

All responses follow a consistent format:
- **Success**: `{ ...data }` or `{ items: [...] }`
- **Error**: `{ error: { code: "ERROR_CODE", message: "Human readable message" } }`

## Authentication

All protected endpoints require an `Authorization` header:
```
Authorization: Bearer <access_token>
```

Both JWT tokens and API keys (`fai_...`) are accepted.

### POST /auth/register

Create a new account.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass1",
  "name": "John Doe"
}
```

**Password requirements:** Min 8 chars, at least one uppercase letter, at least one number.

**Response (201):**
```json
{
  "user": { "id": "...", "email": "...", "name": "...", "plan": "FREE" },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### POST /auth/login

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass1"
}
```

**Response (200):** Same format as register.

### POST /auth/refresh

Rotate refresh token. The old token is invalidated.

**Body:**
```json
{ "refreshToken": "eyJ..." }
```

**Response (200):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

**Security:** If a previously-used refresh token is submitted (token reuse), all sessions for that user are revoked.

### POST /auth/logout

Invalidate the current refresh token.

**Body:**
```json
{ "refreshToken": "eyJ..." }
```

### GET /auth/me

Get current user profile. **Requires auth.**

### PATCH /auth/me/settings

Update user settings. **Requires auth.**

**Body:**
```json
{
  "settings": {
    "theme": "dark",
    "editorFontSize": 14,
    "autoSave": true,
    "name": "New Name"
  }
}
```

## API Keys

### GET /auth/api-keys

List all API keys for the current user. **Requires auth.**

### POST /auth/api-keys

Create a new API key. **Requires auth.**

**Body:**
```json
{ "name": "My Integration" }
```

**Response (201):**
```json
{
  "key": "fai_a1b2c3d4...",
  "prefix": "fai_a1b2c3d4",
  "name": "My Integration"
}
```

The full key is only shown once.

### DELETE /auth/api-keys/:keyId

Delete an API key. **Requires auth.**

## Projects

### POST /projects

Create a new project. **Requires auth.**

**Body:**
```json
{
  "name": "My App",
  "framework": "react-vite",
  "description": "A todo app",
  "template": "blank"
}
```

### GET /projects

List user's projects. **Requires auth.**

### GET /projects/:id

Get project details. **Requires auth.**

### DELETE /projects/:id

Delete a project. **Requires auth.**

## Messages (AI Agent)

### POST /projects/:id/messages

Send a message to the AI agent. **Requires auth.**

**Body:**
```json
{
  "content": "Add a dark mode toggle to the settings page"
}
```

The response streams via WebSocket. See WebSocket Events below.

### GET /projects/:id/messages

Get message history for a project. **Requires auth.**

## Sharing

### POST /projects/:id/share

Share a project with another user. **Requires auth.**

**Body:**
```json
{
  "email": "collaborator@example.com",
  "role": "editor"
}
```

### GET /projects/:id/members

List project members. **Requires auth.**

### DELETE /projects/:id/members/:memberId

Remove a project member. **Requires auth.**

## Export & Import

### GET /projects/:id/export/zip

Download project as ZIP. **Requires auth.**

### POST /projects/:id/export/github

Push project to GitHub. **Requires auth.**

**Body:**
```json
{
  "repo": "username/repo-name",
  "branch": "main"
}
```

### POST /projects/:id/fork

Fork a project. **Requires auth.**

## Sandbox

### GET /projects/:id/sandbox/status

Get sandbox (dev server) status. **Requires auth.**

### POST /projects/:id/sandbox/restart

Restart the project sandbox. **Requires auth.**

### GET /projects/:id/sandbox/files

Get the file tree. **Requires auth.**

### GET /projects/:id/sandbox/files/*

Read a specific file. **Requires auth.**

## Notifications

### GET /notifications

List user notifications. **Requires auth.**

### PATCH /notifications/:id/read

Mark notification as read. **Requires auth.**

### POST /notifications/read-all

Mark all notifications as read. **Requires auth.**

## System

### GET /health

Health check endpoint. **Public.**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "0.1.0",
  "uptime": 3600,
  "services": { "database": "ok" }
}
```

### GET /metrics

Application metrics. **Requires auth.**

```json
{
  "timestamp": "...",
  "uptime": 3600,
  "counts": { "users": 42, "projects": 156, "messages": 8234 },
  "memory": { "rss": 128, "heapUsed": 64, "heapTotal": 96 }
}
```

## WebSocket Events

Connect to `ws://localhost:8000` with Socket.IO.

### Client → Server

| Event | Payload | Description |
| ----- | ------- | ----------- |
| `join-project` | `{ projectId }` | Join project room |
| `leave-project` | `{ projectId }` | Leave project room |

### Server → Client

| Event | Payload | Description |
| ----- | ------- | ----------- |
| `agent:thinking` | `{ projectId, agent }` | Agent started processing |
| `agent:plan` | `{ projectId, plan }` | Planner produced a plan |
| `agent:code` | `{ projectId, files }` | Coder produced code changes |
| `agent:done` | `{ projectId, message }` | Agent completed |
| `agent:error` | `{ projectId, error }` | Agent encountered error |
| `sandbox:output` | `{ projectId, text }` | Dev server console output |
| `file:updated` | `{ projectId, path }` | File was modified |

## Error Codes

| Code | HTTP | Description |
| ---- | ---- | ----------- |
| `AUTH_REQUIRED` | 401 | No authorization token provided |
| `AUTH_INVALID` | 401 | Invalid or expired token/API key |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `INVALID_INPUT` | 400 | Request validation failed |
| `CONFLICT` | 409 | Resource already exists |
| `CREDITS_DEPLETED` | 402 | User has no remaining credits |
| `RATE_LIMITED` | 429 | Too many requests |
| `SANDBOX_ERROR` | 500 | Sandbox operation failed |
| `AGENT_ERROR` | 500 | AI agent processing failed |
| `INTERNAL` | 500 | Unexpected server error |

## Rate Limits

Rate limits are per-user, per-minute. Response headers:
- `X-RateLimit-Limit` — Max requests in window
- `X-RateLimit-Remaining` — Remaining requests
- `X-RateLimit-Reset` — Window reset timestamp (Unix)

| Plan       | API (req/min) | Agent (req/min) |
| ---------- | ------------- | --------------- |
| FREE       | 20            | 5               |
| PRO        | 60            | 15              |
| BUSINESS   | 120           | 30              |
| ENTERPRISE | 300           | 60              |
