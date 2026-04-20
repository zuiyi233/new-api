# 外部项目介入条件说明（主项目账号体系对接）

## 1. 文档目的

本文用于说明：外部项目链接至主项目并使用主项目账号体系（注册/登录/OAuth/登出）时，需要满足的接口条件、会话条件、请求条件与代码对应关系。

本文仅陈述当前仓库已实现的技术事实，不包含改造建议或实施方案。

---

## 2. 适用范围

- 主项目：`N:/new-api-main`
- 外部项目（用户提供）：
  - `backend/app/api/auth.py`
  - `backend/app/api/users.py`
  - `backend/app/api/admin.py`
- 外部项目目标：链接主项目并使用主项目注册登录账号。

---

## 3. 外部项目介入主项目的基础条件

## 3.1 可访问主项目 API 基地址

外部项目需可访问主项目 API（示例前缀：`/api/*`）。

状态读取入口：

- `GET /api/status`
- 控制器：`controller/misc.go` -> `GetStatus`

可用于判定的关键开关字段（响应 `data`）：

- `email_verification`
- `linuxdo_oauth`
- `linuxdo_client_id`
- `turnstile_check`
- `turnstile_site_key`
- `registration_code_required`
- `oidc_enabled`
- `oidc_client_id`
- `oidc_authorization_endpoint`

## 3.2 会话保持条件（Cookie 会话）

主项目登录态基于 session：

- 写入位置：`controller/user.go` -> `setupLogin`
- 关键 session 字段：`id`, `username`, `role`, `status`, `group`

外部项目如果以服务端/中间层调用主项目接口，需要保持同一会话上下文（Cookie 持续）。

## 3.3 受保护接口请求头条件

受 `UserAuth()` 保护的接口在鉴权时会检查 `New-Api-User` 请求头：

- 中间件：`middleware/auth.go` -> `authHelper`
- 要求：`New-Api-User` 必须是整数，且与当前认证用户 `id` 一致。

相关典型接口：

- `GET /api/user/self`
- `GET /api/user/self/entitlements`
- `GET /api/user/token`

## 3.4 Turnstile 条件

登录与注册路由挂载了 `TurnstileCheck()`：

- 路由定义：`router/api-router.go`
  - `POST /api/user/login`
  - `POST /api/user/register`

当 `GET /api/status` 返回 `turnstile_check=true` 时，请求需携带可通过校验的 `turnstile` 参数（主项目前端在 query 中携带）。

---

## 4. 主项目注册/登录/OAuth/登出接口与函数映射

## 4.1 注册

- 路由：`POST /api/user/register`
- 路由文件：`router/api-router.go`
- 控制器：`controller/user.go` -> `Register`
- 请求体结构：`RegisterRequest`
  - `username`
  - `password`
  - `email`
  - `verification_code`
  - `aff_code`
  - `registration_code`

与条件相关的校验事实：

- `common.RegisterEnabled`
- `common.PasswordRegisterEnabled`
- `common.EmailVerificationEnabled` 时要求 `email + verification_code`
- `common.RegistrationCodeRequired` 时要求 `registration_code`

## 4.2 登录（本地账号）

- 路由：`POST /api/user/login`
- 控制器：`controller/user.go` -> `Login`
- 请求体结构：`LoginRequest`
  - `username`
  - `password`

登录成功响应由 `setupLogin` 组装，常见字段：

- `id`
- `username`
- `display_name`
- `role`
- `status`
- `group`

2FA 相关行为：

- 若启用 2FA，`Login` 返回 `data.require_2fa=true`
- 后续走：`POST /api/user/login/2fa`
- 控制器：`controller/twofa.go` -> `Verify2FALogin`

## 4.3 邮箱验证码（注册/绑定/重置相关）

发送验证码：

- 路由：`GET /api/verification`
- 控制器：`controller/misc.go` -> `SendEmailVerification`
- 关键 query：`email`, `turnstile`

邮箱绑定：

- 路由：`POST /api/oauth/email/bind`
- 控制器：`controller/user.go` -> `EmailBind`
- 请求体：`email`, `code`

密码重置相关：

- 发送重置邮件：`GET /api/reset_password` -> `controller/misc.go` `SendPasswordResetEmail`
- 执行重置：`POST /api/user/reset` -> `controller/misc.go` `ResetPassword`

## 4.4 LinuxDO OAuth（外部项目可见流程）

state 生成：

- 路由：`GET /api/oauth/state`
- 控制器：`controller/oauth.go` -> `GenerateOAuthCode`
- 作用：写入 session `oauth_state`

回调入口：

- 路由：`GET /api/oauth/:provider`
- 控制器：`controller/oauth.go` -> `HandleOAuth`
- LinuxDO 对应：`/api/oauth/linuxdo`

Provider 实现：

- 文件：`oauth/linuxdo.go`
- 结构体：`LinuxDOProvider`
- 关键函数：
  - `ExchangeToken`
  - `GetUserInfo`
  - `IsUserIDTaken`
  - `FillUserByProviderID`
  - `SetProviderUserID`

用户绑定/创建：

- 函数：`controller/oauth.go` -> `findOrCreateOAuthUser`
- LinuxDO 绑定字段：`model/user.go` -> `User.LinuxDOId`

## 4.5 登出

- 路由：`GET /api/user/logout`
- 控制器：`controller/user.go` -> `Logout`
- 行为：清理当前 session

---

## 5. 外部项目“链接主项目并使用主项目账号”的请求链路（按功能）

## 5.1 本地注册

1. （可选前置）`GET /api/status` 读取开关
2. （当 `email_verification=true`）`GET /api/verification`
3. `POST /api/user/register`

## 5.2 本地登录

1. `POST /api/user/login`
2. （若返回 `require_2fa=true`）`POST /api/user/login/2fa`
3. 使用会话访问受保护接口时携带 `New-Api-User`

## 5.3 LinuxDO OAuth 登录

1. `GET /api/oauth/state`
2. 跳转 LinuxDO 授权页（使用 `linuxdo_client_id`）
3. 回调到主项目：`GET /api/oauth/linuxdo?code=...&state=...`

## 5.4 登出

1. `GET /api/user/logout`

---

## 6. 当前项目与外部项目信息对照（仅事实）

| 对照维度 | 外部项目（用户提供） | 主项目当前实现（本仓库） |
|---|---|---|
| 本地账号 | 有 | `POST /api/user/login` / `POST /api/user/register` |
| 邮箱验证码 | 有 | `GET /api/verification`，验证码校验嵌入注册/绑定/重置流程 |
| LinuxDO OAuth 回调 | 有 | `GET /api/oauth/state` + `GET /api/oauth/linuxdo` |
| 会话刷新 | 有（描述） | 未见专用 `refresh` 路由（路由层检索） |
| 登出 | 有 | `GET /api/user/logout` |
| 用户模型 | `User` + `UserPassword` | `model/user.go` 中 `User.Password`；未检索到 `UserPassword` 定义 |

---

## 7. 代码定位索引（供 AI/工程检索）

- 路由入口：`router/api-router.go`
- 登录/注册/登出/邮箱绑定：`controller/user.go`
  - `Login`
  - `Register`
  - `Logout`
  - `GenerateAccessToken`
  - `EmailBind`
  - `GetSelf`
- 邮箱验证码与重置：`controller/misc.go`
  - `GetStatus`
  - `SendEmailVerification`
  - `SendPasswordResetEmail`
  - `ResetPassword`
- OAuth：`controller/oauth.go`
  - `GenerateOAuthCode`
  - `HandleOAuth`
  - `handleOAuthBind`
  - `findOrCreateOAuthUser`
- LinuxDO Provider：`oauth/linuxdo.go`
  - `LinuxDOProvider`
  - `ExchangeToken`
  - `GetUserInfo`
- 2FA：`controller/twofa.go` -> `Verify2FALogin`
- Passkey 登录：`controller/passkey.go`
  - `PasskeyLoginBegin`
  - `PasskeyLoginFinish`
- 鉴权中间件：`middleware/auth.go` -> `authHelper`
- 用户模型：`model/user.go` -> `User`

---

## 8. 文档边界声明

- 本文为静态代码事实文档。
- 本文不包含运行态验证结论（未联调、未抓包、未端到端测试）。
- 本文不包含改造建议、实施方案与排期信息。
