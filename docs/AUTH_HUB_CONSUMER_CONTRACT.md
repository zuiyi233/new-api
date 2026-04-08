# Auth Hub Consumer Contract (MVP)

## Purpose

This document defines the minimal integration contract for consuming `new-api` as the novel product Auth Hub / AI gateway entry.

Current scope stays within the MVP boundary:

- unified register / login
- registration code validation
- `novel_product` entitlement query
- AI gateway access gate

Out of scope:

- desktop device license
- machine binding
- offline activation files

## Consumer-Facing Endpoints

### 1. System status

`GET /api/status`

Important fields:

- `registration_code_required`
- `novel_product_enabled`
- `server_address`

Use this endpoint to decide whether the client should require a registration code and whether novel product gating is enabled.

### 2. Registration code pre-validation

`POST /api/registration-code/validate`

Request body:

```json
{
  "registration_code": "NOVELMVP-XXXX"
}
```

Success response data:

```json
{
  "available": true,
  "code": "NOVELMVP-XXXX",
  "name": "MVP batch",
  "product_key": "novel_product",
  "status": 1,
  "expires_at": 0,
  "max_uses": 1,
  "used_count": 0
}
```

Failure semantics:

- invalid code
- disabled code
- expired code
- exhausted code

### 3. Register

`POST /api/user/register`

Request body now includes:

```json
{
  "username": "demo",
  "password": "User!2026",
  "registration_code": "NOVELMVP-XXXX"
}
```

Behavior:

1. validate registration code
2. create user only when the code is valid
3. grant `novel_product` entitlement
4. record registration code usage

### 4. Self identity

`GET /api/user/self`

Use the existing session / access token contract for identity retrieval.

### 5. Self entitlements

`GET /api/user/self/entitlements`

Response includes:

- `items`: entitlement records
- `has_novel_product`: boolean shortcut for the novel product gate

## AI Gateway Access Rule

When `novel_product_enabled=true`, normal users must have an active `novel_product` entitlement to access:

- `/pg/chat/completions`
- `/v1/models`
- `/v1/*` relay endpoints
- `/v1beta/*` relay endpoints
- `/mj/*`
- `/suno/*`
- video relay routes under `/v1`, `/kling/v1`, `jimeng`
- `/api/user/self/models`

Admin / root users are allowed for operational access.

Typical denial semantics:

- HTTP `403`
- relay routes return OpenAI-compatible error payload
- API routes return standard JSON `{ success: false, message: ... }`

## Recommended Client Flow

```text
load /api/status
  -> if registration_code_required=true, show registration code field
  -> call /api/registration-code/validate before submit
  -> call /api/user/register
  -> login
  -> call /api/user/self + /api/user/self/entitlements
  -> call AI gateway only when has_novel_product=true
```

## Notes

- The current product key focus is `novel_product`.
- Future products can reuse the same entitlement model without changing the register/login center architecture.
