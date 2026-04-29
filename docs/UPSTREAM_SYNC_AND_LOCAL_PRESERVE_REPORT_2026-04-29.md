# Upstream 同步与二开保留报告（2026-04-29）

## 1. 目标

在 `N:\new-api-main` 合并官方上游 `upstream/main`，并确保本地二开能力（尤其 OIDC + Check-in + classic 码中心页面链路）不被冲掉。

- 执行分支：`sync/upstream-main-20260417`
- 备份分支：`backup/pre-sync-20260429-233500`
- 最终合并提交：`6836fdbe3`

---

## 2. 合并过程结论

### 2.1 上游同步状态

- 已执行：`git fetch upstream --prune`
- 差异计数：`git rev-list --left-right --count sync/upstream-main-20260417...upstream/main`
- 结果：`25 0`
  - 含义：当前分支比 `upstream/main` 超前 25 个本地提交，**不落后上游**。

### 2.2 冲突收敛

本次冲突已收敛并完成提交，重点处理：

1. `model/user.go`
   - 保留本地字段：`ConcurrencyOverride`
   - 保留上游字段：`CreatedAt` / `LastLoginAt`
2. `Dockerfile`
   - 采用上游新版多前端构建路径（包含 `web/classic` + `web/default`）

---

## 3. 二开保留修复（本次关键补丁）

## 问题

`web/classic` 构建时出现页面/组件链路缺失，首个错误表现为：
- `Could not resolve "./pages/CodeCenter" from "src/App.jsx"`

本质是 `web/src -> web/classic/src` 的迁移中，一批本地二开文件未进入 `web/classic/src`。

## 修复动作

从 `HEAD:web/src/...` 恢复并映射到 `web/classic/src/...`（共 30 个文件），包括：

- 页面：
  - `pages/CodeCenter`
  - `pages/CodePublicationCenter`
  - `pages/OrderClaim`
  - `pages/OrderClaimAdmin`
  - `pages/RegistrationCode`
  - `pages/SubscriptionCode`
- 表格组件：
  - `components/table/common/*`
  - `components/table/registration-codes/*`
  - `components/table/subscription-codes/*`
- hooks：
  - `hooks/registration-codes/*`
  - `hooks/subscription-codes/*`

恢复后再次核对 `web/classic/src/App.jsx` 的页面 import，全部能命中对应页面目录。

---

## 4. 关键能力保留核验

## 4.1 Check-in 三档与兼容键

- 证据文件：
  - `setting/operation_setting/checkin_setting.go`
  - `controller/option.go`
- 保留点：
  - `entry_* / basic_* / advanced_*`
  - `min_quota / max_quota` 兼容键

## 4.2 OIDC admin session-first

- 证据文件：`middleware/oidc_admin_token.go`
- 保留点：
  - 注释与逻辑均为 session-first
  - `X-Admin-Token` 作为 fallback

## 4.3 OIDC userinfo 余额字段

- 证据文件：`controller/oidc_provider.go`
- 保留点：
  - `quota`
  - `used_quota`
  - `remain_quota`
  - `balance`

---

## 5. 验证命令与结果

## 5.1 前端构建

1. `cd web\classic && npm run build`
   - 结果：✅ 成功
2. `cd web\default && npm install && npm run build`
   - 结果：✅ 成功

## 5.2 后端测试

1. `go test ./...`
   - 结果：✅ 全量通过
2. 定向测试（checkin / OIDC middleware）
   - `go test ./controller -run 'TestConvertCheckinOptionValue...|TestHubSessionBootstrapOIDCAndSystemAccessTokenFlow' -v`
   - `go test ./middleware -run 'TestOIDCAdminTokenAuthAllowsAdminSession|TestOIDCAdminTokenAuthRejectsMissingCredential' -v`
   - `go test ./model -run 'TestBuildUserCheckinEligibility...|TestGenerateRandomQuotaAward...' -v`
   - 结果：✅ 通过

## 5.3 可执行文件构建

- `go build -o N:\new-api-main\new-api.exe .`
- 结果：✅ 成功，`new-api.exe` 已更新

---

## 6. 最终结论

1. 已完成与官方上游的同步合并，当前分支不落后上游。
2. 已修复 classic 前端因本地二开文件缺失导致的编译中断。
3. Check-in / OIDC 关键二开能力已保留并通过可执行验证。
4. `N:\new-api-main\new-api.exe` 已重新构建成功。

---

## 7. 仍需人工 UI 烟测的边界（非阻断）

本次已完成编译和测试级验证；但以下属于“浏览器交互层”验证，建议上线前人工过一遍：

- classic 设置页中 OIDC 客户端管理页面的完整点击流
- 码中心（兑换码/注册码/订阅码）分页、批量操作、导入导出按钮联动
- session-only 管理态下（无 localStorage token）的 OIDC 设置接口访问体验
