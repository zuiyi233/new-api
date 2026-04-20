# 外部认证项目接入与协作技术对照文档（客观中立版）

## 1. 文档定位

- 文档目标：记录“外部项目认证流程”与“当前项目（new-api）认证实现”的可对照事实。
- 受众：AI 代理、后端/前端开发、测试与架构评审人员。
- 内容边界：
  - 仅呈现已观察到的功能实现细节、路径、函数、接口与模型信息。
  - 仅给出对比结果，不包含改进建议、实现方案、迁移步骤、优先级结论。

---

## 2. 证据来源与验证范围

### 2.1 当前项目（本仓库）证据来源

静态代码核对（未启动服务、未执行测试）：

- 路由：`router/api-router.go`
- 账号与会话：`controller/user.go`
- 邮箱验证码与重置：`controller/misc.go`
- OAuth 入口与回调：`controller/oauth.go`
- LinuxDO Provider：`oauth/linuxdo.go`
- 2FA：`controller/twofa.go`, `model/twofa.go`
- Passkey：`controller/passkey.go`, `model/passkey.go`
- 鉴权中间件：`middleware/auth.go`
- 用户模型：`model/user.go`
- 自定义 OAuth 绑定模型：`model/user_oauth_binding.go`
- 前端 OAuth 发起与回调：`web/src/helpers/api.js`, `web/src/components/auth/OAuth2Callback.jsx`, `web/src/App.jsx`

### 2.2 外部项目证据来源（用户提供）

已提供信息：

- 路由文件：
  - `backend/app/api/auth.py`
  - `backend/app/api/users.py`
  - `backend/app/api/admin.py`
- 可见流程：
  - 本地账号
  - 邮箱验证码
  - LinuxDO OAuth 回调
  - 会话刷新
  - 登出
- 用户模型：
  - `User`
  - `UserPassword`

### 2.3 验证限制

- 本文不包含外部项目源码逐行核查结果（仅基于已提供信息）。
- 本文不包含运行态行为验证（未进行联调、未抓包、未执行端到端测试）。

---

## 3. 外部项目（参考）已知认证面

| 维度 | 已知事实 | 证据级别 |
|---|---|---|
| 路由组织 | 认证相关在 `auth.py/users.py/admin.py` | 用户提供 |
| 认证流程 | 本地账号、邮箱验证码、LinuxDO OAuth 回调、会话刷新、登出 | 用户提供 |
| 用户模型 | `User` 与 `UserPassword` 分离存在 | 用户提供 |

> 说明：外部项目未提供请求/响应字段、状态码语义、会话与 token 介质等细节。

---

## 4. 当前项目认证实现事实索引（new-api）

## 4.1 后端认证路由与控制器映射

| 路由 | 方法 | 控制器函数 | 文件 |
|---|---|---|---|
| `/api/user/register` | POST | `Register` | `controller/user.go` |
| `/api/user/login` | POST | `Login` | `controller/user.go` |
| `/api/user/login/2fa` | POST | `Verify2FALogin` | `controller/twofa.go` |
| `/api/user/passkey/login/begin` | POST | `PasskeyLoginBegin` | `controller/passkey.go` |
| `/api/user/passkey/login/finish` | POST | `PasskeyLoginFinish` | `controller/passkey.go` |
| `/api/user/logout` | GET | `Logout` | `controller/user.go` |
| `/api/verification` | GET | `SendEmailVerification` | `controller/misc.go` |
| `/api/reset_password` | GET | `SendPasswordResetEmail` | `controller/misc.go` |
| `/api/user/reset` | POST | `ResetPassword` | `controller/misc.go` |
| `/api/oauth/state` | GET | `GenerateOAuthCode` | `controller/oauth.go` |
| `/api/oauth/:provider` | GET | `HandleOAuth` | `controller/oauth.go` |
| `/api/oauth/email/bind` | POST | `EmailBind` | `controller/user.go` |
| `/api/user/self` | GET | `GetSelf` | `controller/user.go` |
| `/api/user/self/entitlements` | GET | `GetSelfEntitlements` | `controller/user.go` |
| `/api/user/token` | GET | `GenerateAccessToken` | `controller/user.go` |

补充（安全验证相关）：

| 路由 | 方法 | 控制器函数 | 文件 |
|---|---|---|---|
| `/api/verify` | POST | `UniversalVerify` | `controller/secure_verification.go` |
| `/api/user/2fa/status` | GET | `Get2FAStatus` | `controller/twofa.go` |
| `/api/user/2fa/setup` | POST | `Setup2FA` | `controller/twofa.go` |
| `/api/user/2fa/enable` | POST | `Enable2FA` | `controller/twofa.go` |
| `/api/user/2fa/disable` | POST | `Disable2FA` | `controller/twofa.go` |
| `/api/user/2fa/backup_codes` | POST | `RegenerateBackupCodes` | `controller/twofa.go` |

## 4.2 LinuxDO OAuth 链路（当前项目）

### 4.2.1 Provider 注册与实现

- Provider 注册：`oauth/linuxdo.go` → `init()` 中 `Register("linuxdo", &LinuxDOProvider{})`
- 主要实现函数：
  - `ExchangeToken(ctx, code, c)`
  - `GetUserInfo(ctx, token)`
  - `IsUserIDTaken(providerUserID)`
  - `FillUserByProviderID(user, providerUserID)`
  - `SetProviderUserID(user, providerUserID)`
  - `GetProviderPrefix()`

### 4.2.2 状态码与回调处理

- state 生成：`controller/oauth.go` → `GenerateOAuthCode`
- 回调入口：`controller/oauth.go` → `HandleOAuth`
- 处理流程包含：
  1. provider 解析：`oauth.GetProvider(providerName)`
  2. session 中 `oauth_state` 校验
  3. token 交换：`provider.ExchangeToken(...)`
  4. 用户信息获取：`provider.GetUserInfo(...)`
  5. 用户绑定/创建：`findOrCreateOAuthUser(...)`
  6. 登录态写入：`setupLogin(...)`

### 4.2.3 前端触发点

- 发起 LinuxDO OAuth：`web/src/helpers/api.js` → `onLinuxDOOAuthClicked(...)`
- 回调组件：`web/src/components/auth/OAuth2Callback.jsx`
- 回调路由：`web/src/App.jsx` 中 `/oauth/linuxdo` 与通用 `/oauth/:provider`

## 4.3 会话、鉴权与“刷新”相关事实

### 4.3.1 会话写入与登出

- 登录态写入：`controller/user.go` → `setupLogin`
  - session 字段：`id`, `username`, `role`, `status`, `group`
- 登出：`controller/user.go` → `Logout`
  - 行为：`session.Clear()` + `session.Save()`

### 4.3.2 中间件鉴权约束

- 文件：`middleware/auth.go` → `authHelper`
- 约束事实：
  - 支持 session 或 `Authorization` access token 验证。
  - 对受保护接口额外校验请求头：`New-Api-User`（与登录用户 id 一致）。

### 4.3.3 刷新相关接口观察结果

- 路由层未观察到专用会话刷新端点（例如 `/api/user/refresh`）。
- 已有接口中与“令牌更新”相关的是：`GET /api/user/token`（`GenerateAccessToken`，生成系统管理 access token）。

## 4.4 邮箱验证码相关事实

- 发送验证码：`GET /api/verification` → `SendEmailVerification`
- 验证码校验使用点：
  - 注册流程：`controller/user.go` → `Register`
  - 邮箱绑定流程：`controller/user.go` → `EmailBind`
  - 重置密码流程：`controller/misc.go` → `ResetPassword`
- 存储实现：`common/verification.go`（`verificationMap`）

## 4.5 用户与认证相关模型事实

### 4.5.1 当前项目用户模型

- 文件：`model/user.go` → `type User struct`
- 认证相关字段（节选）：
  - 本地认证：`Username`, `Password`, `Email`
  - 会话/令牌：`AccessToken`
  - OAuth 绑定：`GitHubId`, `DiscordId`, `OidcId`, `WeChatId`, `TelegramId`, `LinuxDOId`

### 4.5.2 2FA/Passkey/自定义 OAuth 绑定模型

- 2FA：`model/twofa.go`
- Passkey：`model/passkey.go`
- 自定义 OAuth 绑定：`model/user_oauth_binding.go`

### 4.5.3 `UserPassword` 模型检索结果

- 在当前项目 Go 代码中未检索到 `type UserPassword` 或 `UserPassword` 标识符定义。

---

## 5. 外部项目与当前项目对比结果（仅事实对照）

| 对照项 | 外部项目（已知） | 当前项目（已核对） | 对照结果 |
|---|---|---|---|
| 本地账号登录 | 存在 | `POST /api/user/login` + `Login` | 对齐（能力存在） |
| 邮箱验证码流程 | 存在 | `GET /api/verification` + 在注册/绑定/重置中校验 | 部分对齐（发送独立，验证嵌入业务流程） |
| LinuxDO OAuth 回调 | 存在 | `GET /api/oauth/state` + `GET /api/oauth/linuxdo`（经 `/api/oauth/:provider`） | 对齐（能力存在） |
| 会话刷新 | 存在（用户描述） | 未观察到专用 refresh 路由 | 差异（当前未见同名能力） |
| 登出 | 存在 | `GET /api/user/logout` + `Logout` | 对齐（能力存在） |
| 用户密码模型 | `User` + `UserPassword` | `User.Password` 位于 `model/user.go`，未见 `UserPassword` 模型 | 差异（模型结构不同） |

---

## 6. AI 可消费的路径/函数索引（结构化）

```yaml
external_project_known:
  route_files:
    - backend/app/api/auth.py
    - backend/app/api/users.py
    - backend/app/api/admin.py
  visible_flows:
    - local_account
    - email_verification_code
    - linuxdo_oauth_callback
    - session_refresh
    - logout
  models:
    - User
    - UserPassword

current_project_facts:
  router_file: router/api-router.go
  controller_files:
    - controller/user.go
    - controller/misc.go
    - controller/oauth.go
    - controller/twofa.go
    - controller/passkey.go
    - controller/secure_verification.go
  oauth_provider_file: oauth/linuxdo.go
  middleware_file: middleware/auth.go
  model_files:
    - model/user.go
    - model/twofa.go
    - model/passkey.go
    - model/user_oauth_binding.go
  frontend_files:
    - web/src/helpers/api.js
    - web/src/components/auth/OAuth2Callback.jsx
    - web/src/App.jsx
```

---

## 7. 结论表达规范（本文件约束）

- 本文件结论均为“代码事实对照结论”。
- 本文件不包含改进建议、不包含实现方案、不包含迁移计划。
- 本文件未包含运行态验证与外部项目源码级核验结论。
