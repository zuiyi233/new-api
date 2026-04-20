# DeerFlow Tauri 启动器账号中枢：Phase 1 + Phase 2 实施计划

> 版本：v1.0  
> 日期：2026-04-18  
> 适用仓库：`N:\new-api-main`  
> 文档性质：实现计划（未执行代码改造）

---

## 1. 目标与边界

### 1.1 目标

为 Tauri 外壳提供可落地的账号联动能力，最终支持启动前统一判定：

- `allow`
- `deny`
- `require_login`
- `require_update`

并逐步补齐：登录、邀请码/注册码、设备、套餐、版本、下载票据。

### 1.2 三层身份边界（必须保持）

- **用户身份**（谁）
- **工作区/业务身份**（访问哪个业务能力）
- **设备/license 身份**（哪台机器可启动）

> 不能把三者混在一起建模。

### 1.3 非目标（当前计划不做）

- 一步到位做标准 OAuth2/OIDC Provider 全套（discovery/authorize/token/userinfo/jwks）
- 离线激活全功能（可后续单独扩展）

---

## 2. 当前仓库能力盘点（可复用）

已具备（可直接复用）：

- 注册/登录：`/api/user/register`、`/api/user/login`
- 注册码预校验：`/api/registration-code/validate`
- 当前用户与权益：`/api/user/self`、`/api/user/self/entitlements`
- 订阅信息：`/api/subscription/self`
- 系统状态：`/api/status`（含 `registration_code_required`、`novel_product_enabled`）

约束：

- 受保护接口通常要求：`Authorization` + `New-Api-User`/`New-API-User`
- 当前没有完整设备绑定、客户端 bootstrap、license 刷新、release/download-ticket 能力

---

## 3. 总体分期策略

- **Phase 1（快速闭环）**：先让 Tauri 启动前拿到统一结论（不引入复杂设备绑定）
- **Phase 2（能力补齐）**：补设备绑定、license 刷新、版本分发、下载票据

---

## 4. Phase 1（MVP）：启动判定闭环

### 4.1 目标

在最小改造下，让 Tauri 按统一接口拿到可执行决策。

### 4.2 计划周期

- 3~5 天（后端 + 自测 + 联调）

### 4.3 交付清单

#### A. 新增统一判定接口（核心）

**`POST /api/client/bootstrap`**

职责：汇总当前用户登录态、权益、订阅、系统配置，给出启动决策。

请求（建议）：

```json
{
  "client": {
    "app_id": "deerflow-desktop",
    "platform": "windows",
    "app_version": "0.9.3"
  },
  "context": {
    "expect_product_key": "novel_product"
  }
}
```

响应（建议）：

```json
{
  "success": true,
  "data": {
    "decision": "allow",
    "reason_code": "OK",
    "reason_message": "授权有效",
    "user": {
      "id": 123,
      "username": "demo"
    },
    "entitlement": {
      "has_novel_product": true,
      "items": []
    },
    "subscription": {
      "active": true,
      "nearest_end_time": 1768888888
    },
    "update": {
      "required": false,
      "latest_version": "0.9.3",
      "min_supported_version": "0.9.0"
    },
    "next_refresh_after": 300
  }
}
```

#### B. 邀请码/注册码接入适配（兼容层）

1) **邀请码校验包装接口**（可选但建议）

- `POST /api/invite/verify`
- 内部复用 `aff_code` 规则（只做校验，不落库副作用）

2) **激活兑换包装接口**（建议）

- `POST /api/activation/redeem`
- 内部路由到现有 `registration_code` 校验与 `redeem-code` 逻辑
- 对 Tauri 返回统一语义（避免客户端感知仓库内历史字段差异）

#### C. 启动状态决策规则（Phase 1 简化版）

按优先级：

1. 未登录/鉴权失败 -> `require_login`
2. 登录但无目标权益 -> `deny`
3. 登录+有权益，且版本低于最小支持版本 -> `require_update`
4. 其余 -> `allow`

> Phase 1 先不引入“设备绑定拦截”。

### 4.4 最小数据改造

Phase 1 可先不新增复杂表。仅建议新增配置项（Option）：

- `DesktopBootstrapEnabled`
- `DesktopMinSupportedVersion`
- `DesktopLatestVersion`
- `DesktopForceUpdateEnabled`

### 4.5 代码结构建议

- `router/api-router.go`：挂载 `client`/`invite`/`activation` 新路由
- `controller/client_bootstrap.go`：接口编排
- `service/client_bootstrap_service.go`：规则判定
- `dto/client_bootstrap.go`：请求/响应 DTO

### 4.6 Phase 1 验收标准

- Tauri 能通过一个接口拿到启动结论
- 决策枚举稳定：`allow | deny | require_login | require_update`
- 误判率可追踪（日志含 reason_code）
- 至少完成接口级测试 + 关键路径联调

---

## 5. Phase 2：设备 + License + 版本分发补齐

### 5.1 目标

补全“可运营的桌面授权体系”：设备控制、会话续签、版本策略、下载授权。

### 5.2 计划周期

- 1~2 周（视安全要求可延长）

### 5.3 交付清单

#### A. 设备注册与策略

**`POST /api/device/register`**

- 首次绑定设备（或更新设备信息）
- 返回设备状态：`allowed / blocked / over_limit`

建议表：`client_devices`

关键字段：

- `id`
- `user_id`
- `device_fingerprint_hash`
- `device_name`
- `platform`
- `status`（active/blocked/revoked）
- `first_seen_at` `last_seen_at`
- `bind_source`

#### B. 启动 license 刷新

**`POST /api/client/refresh-license`**

- 用短期 refresh 凭据换新启动凭据
- 返回新的有效期和约束条件

建议表：`client_sessions`（或 `client_licenses`）

关键字段：

- `session_id`
- `user_id`
- `device_id`
- `issued_at`
- `expires_at`
- `status`
- `jti`（防重放）

#### C. 版本查询

**`GET /api/release/latest`**

- 按平台/渠道/灰度返回最新版本信息
- 支持最小版本策略与强更标记

建议表：`client_releases`

关键字段：

- `version`
- `platform`
- `channel`
- `min_supported_version`
- `force_update`
- `download_url`
- `sha256`
- `published_at`

#### D. 下载票据

**`POST /api/download-ticket`**

- 生成短时一次性下载票据
- 下载时校验票据并防重放

建议表：`download_tickets`

关键字段：

- `ticket`
- `user_id`
- `release_id`
- `expires_at`
- `used_at`
- `ip_limit`

### 5.4 Phase 2 决策升级

`/api/client/bootstrap` 在 Phase 2 增强为：

1. 未登录 -> `require_login`
2. 登录但设备未注册/超限/被封 -> `deny`
3. 登录 + 设备有效 + 权益无效 -> `deny`
4. 登录 + 设备有效 + 权益有效 + 版本过低 -> `require_update`
5. 全通过 -> `allow`

### 5.5 安全要求（Phase 2 必做）

- 设备指纹只存 hash，不存原文敏感值
- 票据必须短 TTL + 一次性消费
- 所有启动判定写审计日志（谁、哪台设备、为何拒绝）
- 对高频 `bootstrap/refresh-license` 做限流

### 5.6 Phase 2 验收标准

- 设备可控：可绑定、可封禁、可审计
- license 可续签与失效
- 强更可生效
- 下载路径可控（无票据不可下）

---

## 6. 接口兼容与迁移策略

### 6.1 兼容原则

- 对 Tauri 暴露统一新接口；内部复用旧接口能力
- 逐步将 Tauri 从“多接口拼装”迁移到“bootstrap 单接口判定”

### 6.2 迁移顺序

1. 先上线 `/api/client/bootstrap`（只读判定）
2. 再接入 `/api/activation/redeem`（统一激活语义）
3. 再上线设备与 license
4. 最后接入 release + ticket

---

## 7. 测试与验证计划

### 7.1 Phase 1

- 单元测试：决策函数（4 种 decision）
- 接口测试：登录态/未登录/无权益/低版本
- 联调测试：Tauri 启动时能稳定消费 bootstrap

### 7.2 Phase 2

- 设备并发注册冲突测试
- ticket 重放攻击测试
- 版本强更回滚演练
- 异常策略测试（服务不可用时的客户端降级）

---

## 8. 风险与控制

### 风险 1：把业务授权和设备授权混为一谈

- 控制：保持 user/workspace/device 三层模型分离

### 风险 2：一次做太多导致周期失控

- 控制：严格 Phase 1 先闭环，再推进 Phase 2

### 风险 3：下载票据与 license 安全薄弱

- 控制：Phase 2 必做短期票据、一次性消费、审计日志

---

## 9. 任务分解（可执行）

### Phase 1 Checklist

- [ ] 定义 `client/bootstrap` DTO
- [ ] 实现 bootstrap service 决策引擎
- [ ] 新增 `/api/client/bootstrap` 路由与控制器
- [ ] 新增 `invite/verify` 与 `activation/redeem` 兼容接口（可选）
- [ ] 增加配置项：最小版本/最新版本/强更开关
- [ ] 接口测试 + 与 Tauri 联调

### Phase 2 Checklist

- [ ] 设计并创建 `client_devices` 表
- [ ] 实现 `/api/device/register`
- [ ] 设计并创建 `client_sessions`（或 licenses）表
- [ ] 实现 `/api/client/refresh-license`
- [ ] 设计并创建 `client_releases` + `/api/release/latest`
- [ ] 设计并创建 `download_tickets` + `/api/download-ticket`
- [ ] 增加审计日志与限流策略
- [ ] 安全测试与灰度上线

---

## 10. 最终建议（决策）

- **现在就做：Phase 1**（快、稳、对启动器收益最大）
- **确认 Phase 1 稳定后，再做 Phase 2**（设备+license+分发是硬复杂度）
- 不建议两期合并一次性开发。

