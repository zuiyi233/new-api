# Auth Hub MVP Consumer Contract

## Purpose

This document defines the minimum integration contract for consuming `new-api` as the auth hub for the novel product MVP.

Current scope:

- unified registration / login
- registration code validation
- `novel_product` entitlement query
- AI gateway access controlled by `novel_product`

Out of scope:

- device-level desktop license
- machine binding
- offline activation files
- novel main-project business changes

## Base URL

Use the deployed auth hub base URL, for example:

- `http://localhost:45217`

Production should replace this with the actual auth hub domain.

## Identity and Session

### Session login

- `POST /api/user/login`

Returns the current user identity and establishes the dashboard session.

### Self identity

- `GET /api/user/self`
- requires authenticated session
- requires header: `New-API-User: {current_user_id}`
- the header is not a standalone auth credential; it must match the authenticated session user id enforced by current `UserAuth()` middleware

Consumer use:

- obtain current user id
- obtain current user role / group / profile basics

## Registration Contract

### Registration code pre-validation

- `POST /api/registration-code/validate`

Request body:

```json
{
  "registration_code": "NOVELMVP-XXXX"
}
```

Success response shape:

```json
{
  "success": true,
  "message": "",
  "data": {
    "available": true,
    "code": "NOVELMVP-XXXX",
    "name": "Novel MVP batch",
    "product_key": "novel_product",
    "status": 1,
    "expires_at": 0,
    "max_uses": 1,
    "used_count": 0,
    "remaining_uses": 1
  }
}
```

Failure response shape:

```json
{
  "success": false,
  "message": "注册码已过期"
}
```

Notes:

- this is a pre-check for user experience
- final registration still performs authoritative validation inside the registration transaction

### Registration submit

- `POST /api/user/register`

Request body includes:

```json
{
  "username": "user1",
  "password": "User!2026",
  "registration_code": "NOVELMVP-XXXX"
}
```

Rules:

- when `registration_code_required=true`, registration code is mandatory
- the registration transaction validates the code again
- successful registration grants `novel_product` entitlement automatically

## Entitlement Contract

### Self entitlements

- `GET /api/user/self/entitlements`
- requires authenticated session
- requires header: `New-API-User: {current_user_id}`
- the header must match the authenticated session user id

Response shape:

```json
{
  "success": true,
  "message": "",
  "data": {
    "items": [
      {
        "id": 1,
        "user_id": 100,
        "product_key": "novel_product",
        "status": 1,
        "source_type": "registration_code",
        "source_id": 12,
        "granted_at": 1710000000,
        "expires_at": 0,
        "notes": "注册获得产品资格，source=registration_code"
      }
    ],
    "has_novel_product": true
  }
}
```

Consumer recommendation:

- prefer `has_novel_product` for fast allow/deny decisions
- use `items` only when detailed entitlement metadata is needed

## Status Contract

### Public status

- `GET /api/status`

Relevant fields:

```json
{
  "registration_code_required": true,
  "novel_product_enabled": true
}
```

Consumer use:

- decide whether registration UI must require a registration code
- detect whether the auth hub currently exposes novel-product capability

## AI Gateway Contract

### Access rule

Users must have an active `novel_product` entitlement before using the novel-facing AI gateway entry points.

Typical protected entry points include:

- playground relay entry
- token-auth relay entry
- model listing endpoints intended for gateway consumption

If the entitlement is missing or inactive, the gateway returns a forbidden error.

## Error Handling Guidance

Consumer should treat the following as user-facing business denials, not transport failures:

- invalid registration code
- expired registration code
- exhausted registration code
- disabled registration code
- missing `novel_product` entitlement

## Integration Sequence for Novel Main Project

1. redirect or link user to auth hub registration / login
2. retrieve current user identity from auth hub
3. query `/api/user/self/entitlements`
4. allow novel product only when `has_novel_product=true`
5. send AI traffic through the auth hub gateway instead of directly aggregating upstream providers in the novel project
