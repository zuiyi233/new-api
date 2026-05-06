# OIDC `invalid_client`（重建后复发）排障与防复发手册（2026-04-30）

## 1. 适用场景

当你看到以下日志组合时，适用本手册：

- `action=authorize ... result=success detail="issued authorization code"`
- 紧接着 `action=token ... result=failed detail="client secret mismatch ... invalid client secret"`
- `/oauth/token` 返回 `401 invalid_client`

这说明 **authorize 阶段正常**，问题在 **token 阶段的 client_secret 校验失败**。

---

## 2. 根因（为什么重建后容易复发）

本项目 OIDC client secret 的校验哈希依赖 `CRYPTO_SECRET`：

- `model/oidc_provider_models.go` -> `hashOIDCValue()`
- `common/crypto.go` -> `GenerateHMAC()`（使用 `CryptoSecret`）

而 `SessionSecret/CryptoSecret` 在未显式配置时会走随机默认值：

- `common/constants.go`
  - `SessionSecret = uuid.New().String()`
  - `CryptoSecret = uuid.New().String()`

因此，如果 Provider 每次重建/重启时密钥发生变化，历史保存的 `client_secret_hash` 会全部失效，稳定触发 `invalid_client`。

> 简单说：**不是账号没登录，也不是授权码没发出来，是哈希盐变了。**

---

## 3. 本次（2026-04-30）已落地修复内容

> 注意：以下写的是“修复动作与位置”，不在文档里保留明文生产密钥。

1. 固定 Provider 运行密钥（防漂移）
   - 新增/更新：`N:\new-api-main\.env`
   - 固定项：
     - `SESSION_SECRET=...`
     - `CRYPTO_SECRET=...`

2. 重新对齐 OIDC client secret（防历史 hash 失配）
   - 更新 `oauth_clients.client_secret_hash`（目标 `client_id`）
   - 目标 client：`oidc_Cd22JemgQrlLeRsVEvNtYQMQ`

3. 同步调用方（Consumer）配置
   - 更新：`N:\xiaoye-ai-main\backend\.env`
   - 对齐项：
     - `NEWAPI_OAUTH_CLIENT_ID`
     - `NEWAPI_OAUTH_CLIENT_SECRET`

4. 重启顺序
   - 先重启 Provider（`N:\new-api-main\new-api.exe`）
   - 再重启 Consumer backend（`N:\xiaoye-ai-main\backend`）

---

## 4. 以后每次重建/发布的标准步骤（必须按顺序）

### Step A：先确认 Provider 密钥是否固定

检查 `N:\new-api-main\.env` 是否存在且包含：

- `SESSION_SECRET`
- `CRYPTO_SECRET`

并且这两个值与历史保持一致（不要每次换新）。

### Step B：如需旋转 client secret，只走“旋转+同步”闭环

1. 在 Provider 旋转 secret：
   - `POST /api/oidc/clients/:client_id/rotate_secret`
2. 拿到新 secret 后立刻同步到 Consumer：
   - `N:\xiaoye-ai-main\backend\.env`
3. 重启 Consumer backend

### Step C：验证（必须做）

#### 验证 1：错误类型判定（快速）

用 **假 code** 测 `/oauth/token`：

- 返回 `400 invalid_grant`：说明 client_secret 已匹配（好）
- 返回 `401 invalid_client`：说明仍有密钥/secret 不一致（坏）

#### 验证 2：真实登录链路

真实登录一次，检查日志应满足：

- `authorize` 成功
- `token` 不再出现 `client secret mismatch`

---

## 5. 常见误区

1. **只改 Consumer 的 `.env`，不固定 Provider 密钥**
   - 结果：下次重建又复发。

2. **Provider 换了 secret，但 Consumer 未同步**
   - 结果：稳定 `invalid_client`。

3. **改完 `.env` 不重启进程**
   - 结果：进程仍使用旧环境。

4. **不同启动方式混用，运行环境不一致**
   - 结果：以为“同一个服务”，实际读取的环境变量不同。

---

## 6. 一键排查清单（值班版）

- [ ] `N:\new-api-main\.env` 存在且有固定 `SESSION_SECRET/CRYPTO_SECRET`
- [ ] Provider 正在运行的实例就是目标实例（端口 3000）
- [ ] `oauth_clients` 中目标 `client_id` 存在且 `enabled=true`
- [ ] Consumer `backend/.env` 的 `NEWAPI_OAUTH_CLIENT_SECRET` 与最新旋转值一致
- [ ] Consumer backend 已重启
- [ ] `/oauth/token` 假 code 返回 `invalid_grant`（不是 `invalid_client`）

---

## 7. 参考代码位置

- `common/constants.go`
- `common/init.go`
- `common/crypto.go`
- `model/oidc_provider_models.go`
- `controller/oidc_provider.go`
- `router/api-router.go`

---

如后续再次出现同类问题，优先按本手册第 4 节执行，不要先改业务代码。
