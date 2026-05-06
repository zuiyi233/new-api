# 第三方登录 OAuth 接入配置文档（NewAPI 生态）

> 文档版本：v1.0  
> 生成日期：2026-04-27  
> 适用范围：第三方业务系统、自动化 AI 系统、接入方开发团队

---

## 1. 接入目标与系统角色

本接入体系由两类系统构成：

1. **主项目（认证与账户中心）**：`http://localhost:3000`  
   - 角色：OAuth 2.0 / OIDC **Provider**（授权服务器 + 用户信息服务）
2. **第三方项目（业务消费端）**：
   - 前端：`http://localhost:38173`
   - 后端：`http://localhost:38092`
   - 管理后台：`http://localhost:38174`
   - 角色：OAuth **Consumer**（发起登录、回调换 token、拉取用户信息与余额）

---

## 2. 当前已集成的第三方登录服务类型

### 2.1 主项目可提供/集成的登录服务类型

| 服务类型 | 协议类型 | 角色 | 主要接入路径 |
|---|---|---|---|
| NewAPI OIDC Provider | OAuth 2.0 + OpenID Connect | 对外 Provider | `:3000/.well-known/*`, `:3000/oauth/*` |
| GitHub 登录 | OAuth 2.0 | 主项目用户登录入口（Consumer） | `:3000/api/oauth/github` |
| Discord 登录 | OAuth 2.0 | 主项目用户登录入口（Consumer） | `:3000/api/oauth/discord` |
| LinuxDO 登录 | OAuth 2.0 | 主项目用户登录入口（Consumer） | `:3000/api/oauth/linuxdo` |
| OIDC 登录（上游） | OAuth 2.0 / OIDC | 主项目用户登录入口（Consumer） | `:3000/api/oauth/oidc` |
| WeChat 登录 | OAuth 2.0（定制） | 主项目用户登录入口（Consumer） | `:3000/api/oauth/wechat` |
| Telegram 登录 | Telegram Login | 主项目用户登录入口（Consumer） | `:3000/api/oauth/telegram/login` |
| 自定义 OAuth Provider | OAuth 2.0 / OIDC（可配） | 主项目用户登录入口（Consumer） | `:3000/api/custom-oauth-provider/*` |

> 说明：本次第三方接入流程使用的是 **NewAPI OIDC Provider**（第一行）。

### 2.2 第三方项目已集成的登录服务类型

| 服务类型 | 协议类型 | 角色 | 接入路径 |
|---|---|---|---|
| NewAPI OAuth/OIDC 登录 | OAuth 2.0 + OIDC | Consumer | `:38092/api/auth/newapi/oauth/start`、`:38092/api/auth/newapi/oauth/callback` |

---

## 3. 端口与服务总览（本地标准联调）

| 端口 | 系统 | 用途 |
|---|---|---|
| `3000` | 主项目 `new-api` | OAuth/OIDC Provider、用户中心、Hub API |
| `38092` | 第三方后端 `xiaoye-ai-main/backend` | OAuth 发起、回调处理、会话接口、后台配置 API |
| `38173` | 第三方前端 `xiaoye-ai-main/frontend` | 用户登录入口与 `/oauth/callback` 页面 |
| `38174` | 第三方管理前端 `xiaoye-ai-main/frontend-admin` | 管理端 UI（配置 OAuth、审计/用户等） |

---

## 4. 功能列表与实现路径（端口 + 接口）

## 4.1 主项目（3000）OAuth/OIDC Provider 功能

| 功能 | 方法 | 实现路径 |
|---|---|---|
| OIDC Discovery | GET | `http://localhost:3000/.well-known/openid-configuration` |
| JWKS 公钥发布 | GET | `http://localhost:3000/.well-known/jwks.json` |
| 授权码授权（Authorize） | GET | `http://localhost:3000/oauth/authorize` |
| 授权码/刷新令牌换取 Token | POST | `http://localhost:3000/oauth/token` |
| 用户信息（含余额字段） | GET | `http://localhost:3000/oauth/userinfo` |
| 令牌吊销 | POST | `http://localhost:3000/oauth/revoke` |
| 令牌状态检查（Introspect） | POST | `http://localhost:3000/oauth/introspect` |

### `/oauth/userinfo` 当前可返回的关键字段（用于第三方会话）

- 身份字段：`sub`, `id`, `preferred_username`, `username`, `email`, `name`, `avatar/picture`
- 余额字段：`balance`, `remain_quota`, `quota`, `used_quota`

---

## 4.2 主项目（3000）Provider 管理功能（管理员）

> 鉴权：管理员会话或 `X-Admin-Token`（主项目管理员系统令牌）

| 功能 | 方法 | 实现路径 |
|---|---|---|
| 查询 OIDC Client 列表 | GET | `http://localhost:3000/api/oidc/clients/` |
| 新建 OIDC Client | POST | `http://localhost:3000/api/oidc/clients/` |
| 更新 OIDC Client | PUT | `http://localhost:3000/api/oidc/clients/{client_id}` |
| 轮换 Client Secret | POST | `http://localhost:3000/api/oidc/clients/{client_id}/rotate_secret` |
| 禁用 Client | POST | `http://localhost:3000/api/oidc/clients/{client_id}/disable` |
| 启用 Client | POST | `http://localhost:3000/api/oidc/clients/{client_id}/enable` |
| 删除 Client | DELETE | `http://localhost:3000/api/oidc/clients/{client_id}` |
| 查询签名密钥 | GET | `http://localhost:3000/api/oidc/signing-keys/` |
| 轮换签名密钥 | POST | `http://localhost:3000/api/oidc/signing-keys/rotate` |
| 激活指定签名密钥 | POST | `http://localhost:3000/api/oidc/signing-keys/{kid}/activate` |

---

## 4.3 第三方后端（38092）OAuth 消费功能

| 功能 | 方法 | 实现路径 |
|---|---|---|
| 发起 OAuth 登录 | GET | `http://localhost:38092/api/auth/newapi/oauth/start` |
| OAuth 回调换 token（后端） | POST/GET | `http://localhost:38092/api/auth/newapi/oauth/callback` |
| OAuth 配置状态检查 | GET | `http://localhost:38092/api/auth/oauth/status` |
| 当前登录会话信息 | GET | `http://localhost:38092/api/session/me` |
| 会话登出 | POST | `http://localhost:38092/api/session/logout` |

### 第三方后端回调能力（已接入）

- 获取并返回：`newapi_access_token`, `newapi_refresh_token`, `newapi_expires_in`
- 创建/更新本地用户映射（`newapi_user_id`）
- 持久化并回传余额快照：`balance`, `remain_quota`, `quota`, `used_quota`

---

## 4.4 第三方后端（38092）管理配置功能

> 鉴权：`X-Admin-Token`（第三方项目后台管理员令牌）

| 功能 | 方法 | 实现路径 |
|---|---|---|
| 获取 OAuth 配置 | GET | `http://localhost:38092/api/admin/oauth` |
| 更新 OAuth 配置 | PUT | `http://localhost:38092/api/admin/oauth` |

历史实现曾支持本地回退文件（APP_ENV=dev/local），但新版本已收敛为**只读环境变量模式**：
- 配置以 `N:\xiaoye-ai-main\backend\.env` 为准（`NEWAPI_OAUTH_*`）

---

## 4.5 前端路由（38173 / 38174）

| 端口 | 路由 | 说明 |
|---|---|---|
| `38173` | `/oauth/callback` | OAuth 回调落地页，接收 `code/state`，触发后端 callback 交换 |
| `38174` | `/`（管理后台） | 管理员配置 OAuth 参数（实际调用 38092 的 `/api/admin/oauth`） |

---

## 5. OAuth 配置参数规范（第三方项目）

## 5.1 必填且建议为绝对 URL

- `authorizeUrl`
- `tokenUrl`
- `userInfoUrl`
- `redirectUrl`

## 5.2 标准配置样例

```json
{
  "authorizeUrl": "http://localhost:3000/oauth/authorize",
  "tokenUrl": "http://localhost:3000/oauth/token",
  "userInfoUrl": "http://localhost:3000/oauth/userinfo",
  "clientId": "<oidc_client_id>",
  "clientSecret": "<oidc_client_secret>",
  "redirectUrl": "http://localhost:38173/oauth/callback",
  "scopes": "openid profile email",
  "userIdField": "sub",
  "userNameField": "preferred_username",
  "userAvatarField": "picture",
  "userEmailField": "email"
}
```

---

## 6. 标准接入流程（第三方/AI 系统）

1. 在主项目创建 OIDC Client（`/api/oidc/clients/`）。
2. 将主项目 `client_id/client_secret` 写入第三方 OAuth 配置（`backend/.env` 的 `NEWAPI_OAUTH_CLIENT_ID / NEWAPI_OAUTH_CLIENT_SECRET`）。
3. 前端调用第三方 `GET /api/auth/newapi/oauth/start` 获取 `authorize_url`。
4. 浏览器跳转主项目 `:3000/oauth/authorize`，用户完成登录与授权。
5. 主项目重定向到 `redirectUrl`（`/oauth/callback`）附带 `code/state`。
6. 第三方后端调用主项目 `:3000/oauth/token` 换取 access/refresh token。
7. 第三方后端调用主项目 `:3000/oauth/userinfo` 获取身份 + 余额字段。
8. 第三方建立本地会话并通过 `/api/session/me` 对外提供统一会话数据。

---

## 7. 可使用功能清单（面向接入方）

| 功能域 | 能力说明 | 依赖接口 |
|---|---|---|
| OAuth 登录 | 完整授权码登录，支持浏览器重定向与回调交换 | `:38092/api/auth/newapi/oauth/start`、`:38092/api/auth/newapi/oauth/callback` |
| 账号身份同步 | 同步主项目用户主键、昵称、头像、邮箱 | `:3000/oauth/userinfo` |
| 余额同步 | 同步 `balance/remain_quota/quota/used_quota` | `:3000/oauth/userinfo` |
| 本地会话查询 | 统一获取第三方会话用户资料与余额快照 | `:38092/api/session/me` |
| 管理配置（仅环境变量） | 管理员在线修改后需重启服务；更新接口返回 501 提示只读模式 | `:38092/api/admin/oauth` |
| AI 系统中控接入（可选） | 一次引导换取系统访问令牌 | `:3000/api/hub/session/bootstrap` |
| 额度与用量快照（可选） | 拉取用户配额、统计、日志趋势 | `:3000/api/user/self`、`:3000/api/data/self`、`:3000/api/log/self/stat`、`:3000/api/log/self` |

---

## 8. 鉴权令牌语义（避免混淆）

| 名称 | 用途 | 来源 | 适用接口 |
|---|---|---|---|
| `newapi_access_token` | 主项目 OIDC access token | `/oauth/token` 返回 | 主项目 `/oauth/userinfo` |
| `local_token` | 第三方本地会话令牌 | 第三方 callback 生成 | 第三方 `/api/session/me` |
| 第三方 `X-Admin-Token` | 第三方后台管理鉴权 | 第三方配置 | 第三方 `/api/admin/*` |
| 主项目 `X-Admin-Token` | 主项目 OIDC 管理 API 鉴权 | 主项目管理员系统令牌 | 主项目 `/api/oidc/*` |
| `system_access_token`（可选） | Hub 适配调用鉴权 | 主项目 `/api/hub/session/bootstrap` 返回 | 主项目 `/api/user/self`、`/api/data/self` 等 |

> 注意：**余额同步不依赖第三方 `X-Admin-Token`**，而依赖 `newapi_access_token -> /oauth/userinfo`。

---

## 9. 常见故障与排查建议

| 现象 | 常见原因 | 排查路径 |
|---|---|---|
| `invalid_client` | client_id / client_secret 不匹配，或 client 被禁用 | `:3000/api/oidc/clients/*` 检查配置与状态 |
| `invalid_grant` | code 过期/已消费，redirect_uri 不一致 | 对比 `redirectUrl` 与 client 注册值（精确匹配） |
| callback 返回 `missing code or state` | 前端未带参数进入 callback | 检查 `authorize_url` 跳转与浏览器地址栏参数 |
| 第三方会话无余额字段 | 第三方后端未重启到新代码，或会话是旧缓存 | 重启 38092 进程并重新 OAuth 登录；刷新 `/api/session/me` |
| AI 系统无法拉取用量快照 | 未执行 Hub bootstrap 或缺少 `New-Api-User` 请求头 | 先调 `:3000/api/hub/session/bootstrap`，再按协议带头调用 |

---

## 10. 对接验收清单（建议）

1. `GET :3000/.well-known/openid-configuration` 返回 200。  
2. `GET :38092/api/auth/newapi/oauth/start` 返回 `authorize_url`。  
3. 完整授权后，`:38092/api/auth/newapi/oauth/callback` 返回 `newapi_access_token` 与 `data.user.balance`。  
4. `GET :38092/api/session/me` 包含 `balance/remain_quota/quota/used_quota`。  
5. （可选）`POST :3000/api/hub/session/bootstrap` 返回 `system_access_token`。  

---

如需上线到非本地环境，仅需将主机名/端口替换为生产域名，并保持路径不变即可。

---

## 11. 2026-04-29 事故记录：`/oauth/token` 返回 `invalid_client`

> 场景：`xiaoye-ai-main` 走 OAuth 回调时，`/oauth/token` 失败，第三方后端报  
> `token endpoint failed: invalid_client - invalid client credentials`。  
> 观测到 `authorize=302` 成功，但 `token=401` 失败。

### 11.1 现象与证据

- 主项目日志（`logs/oneapi-20260429140933.log`）显示：
  - 2026-04-29 14:25:29 / 14:25:35：`GET /oauth/authorize` 返回 `302`
  - 2026-04-29 14:25:30 / 14:25:36：`POST /oauth/token` 返回 `401`
- 增强 OIDC 审计日志后（`controller/oidc_provider.go`）明确打印：
  - `detail="client secret mismatch (auth_method=client_secret_post): invalid client secret"`

### 11.2 根因

本次 `invalid_client` 的直接根因是：**client secret 校验不通过（secret mismatch）**。

进一步定位到两层原因：

1. **Provider 端 secret 哈希依赖运行时 `CRYPTO_SECRET`**  
   OIDC client secret 的哈希逻辑是 `hashOIDCValue -> common.GenerateHMAC("oidc:"+secret)`，而 `GenerateHMAC` 使用 `CRYPTO_SECRET`。  
   若运行态 `CRYPTO_SECRET/SESSION_SECRET` 与创建 client 时不一致，会导致历史 `client_secret` 全部校验失败。
2. **调用方（xiaoye）仍使用旧 secret**  
   当 Provider 端已轮换或重建 secret，但 `xiaoye-ai-main/backend/.env` 中 `NEWAPI_OAUTH_CLIENT_SECRET` 未同步，仍会稳定触发 `invalid_client`。

### 11.3 已执行修复（最小改动）

1. **增强 token 失败分支可观测性**（便于一次定位）  
   - 文件：`controller/oidc_provider.go`  
   - 增加了 `unknown client / client disabled / missing secret / secret mismatch / invalid code` 等分支日志。
2. **固定 Provider 端密钥环境**  
   - 固定 `SESSION_SECRET` 与 `CRYPTO_SECRET`，避免 secret 哈希漂移。
3. **轮换目标 client secret 并同步消费方**
   - 轮换：`POST /api/oidc/clients/{client_id}/rotate_secret`
   - 同步到：`N:\xiaoye-ai-main\backend\.env` 的 `NEWAPI_OAUTH_CLIENT_SECRET`
   - 重启 `xiaoye-ai-main` 后端使配置生效。

### 11.4 复测命令（关键）

1. **Provider 授权码成功**
   - 登录后访问：`GET /oauth/authorize?...`
   - 预期：`302`，`Location` 包含 `code=...`
2. **Token 交换成功**
   - `POST /oauth/token`（`client_secret_post`）
   - 预期：`200`，返回 `access_token`
3. **消费方 callback 不再出现 `invalid_client`**
   - `POST /api/auth/newapi/oauth/callback`
   - 预期：不再返回 `400 invalid_client`

### 11.5 经验与防回归清单

1. 新增/轮换 OIDC client 后，必须同步更新第三方 `.env` 并重启第三方后端。
2. Provider 不要使用随机/漂移的 `CRYPTO_SECRET`；必须固定在部署配置中。
3. 遇到 `authorize=302` 且 `token=401 invalid_client`，优先检查：
   - client 是否存在且 enabled；
   - 调用方 secret 是否最新；
   - Provider 当前 `CRYPTO_SECRET` 是否与 client secret 写入时一致；
   - 调用方认证方法是否符合（`client_secret_post` 或 `client_secret_basic`）。
4. 若 token 已成功但 callback 仍失败，要与 OIDC 问题分离排查第三方本地依赖（如 DB 连接）。
