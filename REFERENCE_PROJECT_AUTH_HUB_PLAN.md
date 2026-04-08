# 参考项目改造成统一账号/邀请码/AI入口中心的实施文档

> 适用对象：后续会在**另一个新的工作区**里，以 `参考项目/new-api-main` 为基础继续开发的 AI / 开发者。
>
> 本文档目标：把当前讨论结果固化下来，让后续执行者**不用重新理解需求**，可以直接按本文档在新工作区展开改造。

---

## 0. 一句话结论

当前最推荐的方向不是在小说主项目里继续补一整套账号/邀请码/授权后台，而是：

**把参考项目 `new-api` 改造成“统一入口中心”**，它同时负责：

1. 注册 / 登录 / 用户管理
2. 邀请码 / 注册码 / 开通码（MVP）
3. AI 网关 / 上游模型聚合能力
4. 给小说主项目提供“这个用户是否允许使用产品”的结果

而当前小说主项目：

- 继续只负责小说业务、创作流程、作品数据
- 短期内现有账号代码可保留但不继续作为长期正式线上账号中心演进
- 后续只消费参考项目提供的登录态 / 用户身份 / 产品资格 / AI能力入口

---

## 1. 这次方案的核心判断

### 1.1 不建议的方向

不建议在小说主项目里继续直接做：

- 完整线上注册/登录中心
- 邀请码/注册码后台
- 运营后台
- AI供应商聚合网关
- 权益开通系统

原因：这会让小说主项目持续承载与“写小说”无关的大量运营系统逻辑，违背“解耦”和“纯业务项目”的目标。

### 1.2 推荐的方向

推荐在 `new-api` 的基础上改造成一个**统一入口中心**，把它当成：

- 账号中心
- 邀请码/注册码中心
- AI网关中心
- 用户准入中心

小说主项目则作为：

- 创作工作台
- 小说/章节/世界观/Author Runtime 的业务系统

---

## 2. 必须先统一的产品理解（非常重要）

后续执行时，不要把下面三个概念混为一谈：

### 2.1 账号系统
解决“你是谁”

- 注册
- 登录
- 找回密码
- OAuth
- 2FA / Passkey
- 用户资料
- 后台用户管理

### 2.2 准入码 / 注册码 / 开通码
解决“你有没有资格进入产品”

MVP 阶段建议把你口中的“激活码”实际收敛为：

- 邀请码
- 注册码
- 开通码
- 准入资格码

它的职责是：

- 控制用户是否允许注册
- 或者控制用户注册后是否可开通小说产品

### 2.3 真正的桌面 License 激活系统
解决“这台设备是否被授权运行桌面版”

包括：

- 设备绑定
- 最大设备数
- 吊销
- 联网复核
- 本地 license 文件
- mismatch / revoked / degraded / damaged 等状态

**本轮不建议先做这一层。**

---

## 3. 本次最终确定的 MVP 范围

### 3.1 先做什么

在参考项目 `new-api` 中实现：

1. 正式注册 / 登录 / OAuth / 账号管理继续沿用现有能力
2. 在注册流程里加入“注册码/邀请码/开通码”校验
3. 注册成功后，为该用户赋予“小说产品可用”资格
4. 保留 `new-api` 作为 AI 网关，继续承接上游模型供应能力
5. 给小说主项目提供：
   - 用户身份
   - 用户是否拥有小说产品资格
   - AI 使用入口

### 3.2 暂时不要做什么

本轮不要在参考项目里实现完整桌面 License 系统：

- 不做设备绑定
- 不做本地授权文件
- 不做桌面离线激活
- 不做设备吊销/换机治理
- 不做复杂的 per-device activation audit

### 3.3 为什么这样收口

因为当前更真实的需求不是“桌面设备授权”，而是：

> 用户必须先通过某种资格校验，才能注册并使用小说产品。

这本质上更适合先做“注册码 / 邀请码 / 准入码”，而不是直接做重型 License 系统。

---

## 4. 推荐的目标架构

```text
[用户浏览器 / 客户端]
        |
        v
[改造后的 new-api]
= 注册/登录 + 邀请码/注册码 + 用户后台 + AI网关 + 产品资格中心
        |
        |  提供用户身份、资格结果、AI入口
        v
[小说主项目]
= 小说/章节/世界观/创作流程/Author Runtime
```

### 4.1 new-api 负责什么

- 注册
- 登录
- OAuth
- 2FA / Passkey
- 用户资料与后台管理
- 邀请码/注册码/准入资格
- AI 网关与上游模型聚合
- 判断用户是否允许使用“小说产品”

### 4.2 小说主项目负责什么

- 作品数据
- 创作流程
- Workspace / Novel / Chapter / Runtime
- 与 AI 写作相关的业务逻辑

### 4.3 小说主项目不再负责什么

长期目标上，不再把小说主项目作为正式线上账号中心：

- 不再成为正式注册入口
- 不再成为正式登录入口
- 不再承载邀请码/注册码后台
- 不再承载 AI 网关与供应商聚合逻辑

> 说明：短期可以保留现有账号相关代码，作为兼容/开发/过渡用途，但不建议继续把它当长期正式入口演进。

---

## 5. 对“主项目现有账号代码”的处理原则

### 5.1 当前结论

**先不删，不大改，但不要继续把它当长期正式账号中心。**

### 5.2 正确理解

- 可以保留现有代码，避免一次性迁移成本太大
- 可以暂时让它用于本地开发、测试或过渡
- 但线上正式环境不建议长期保留“双注册入口 / 双登录入口”

### 5.3 明确禁止的长期形态

不要形成下面这种局面：

- 用户可以在参考项目注册一套账号
- 用户也可以在小说主项目注册另一套账号
- 两边都算正式账号体系

这会导致：

- 用户来源混乱
- token / user_id / 权限不同步
- 产品资格对不上
- 后续集成成本越来越高

---

## 6. 后续新工作区里的 AI 应该怎么理解任务边界

后续 AI **不是**要在当前小说主项目里继续做账号系统改造，而是：

### 6.1 主要工作区
应在新的工作区里，以：

`N:\mojinxiezuo-os-master\参考项目\new-api-main`

作为主要改造对象。

### 6.2 改造目标
把 `new-api` 改造成：

- 统一账号中心
- 注册码/邀请码/准入中心
- AI 网关中心
- 小说产品的资格开通中心

### 6.3 当前小说项目的角色
当前小说项目只作为未来的“消费方 / 集成方”参考，不是本轮主实施对象。

---

## 7. 推荐的实施顺序（按优先级）

### Phase A. 先在 new-api 中做“注册码控制注册资格”

目标：

- 用户注册前必须输入注册码
- 注册码有效才允许创建账号
- 注册成功后用户自动拥有小说产品资格

这是本轮最重要的 MVP。

### Phase B. 再补“产品资格 / entitlement”

目标：

- 系统中明确记录某用户是否拥有“小说产品”使用资格
- 后续支持更多产品 / 更多权限类型

### Phase C. 再考虑“主项目接入统一身份和资格”

目标：

- 小说主项目识别参考项目登录态
- 小说主项目能判断当前用户是否具备小说产品资格
- 小说主项目后续调用 AI 能力走参考项目网关

### Phase D. 如果未来有桌面版正式授权需求，再做 License 子系统

这个不在本轮范围内。

---

## 8. 建议的 MVP 业务流程

### 8.1 最简单流程（推荐）

```text
用户打开注册页
  -> 输入用户名/邮箱/密码/注册码
  -> 系统校验注册码是否有效
  -> 有效：允许注册
  -> 注册成功后自动绑定“小说产品可用”资格
  -> 登录后即可进入小说系统并使用 AI 功能
```

### 8.2 后台能力

管理员需要能：

- 创建注册码
- 批量创建注册码
- 设置数量
- 设置过期时间
- 禁用某个注册码
- 查看哪个注册码被谁使用了
- 查看某个用户是否具备小说产品资格

---

## 9. 对“激活系统”的收敛建议

### 9.1 当前不要把它叫桌面激活系统

在本轮需求里，建议统一叫：

- 注册码
- 邀请码
- 开通码
- 准入码

不要在 MVP 阶段直接把它设计成：

- 设备级 license
- 桌面激活码
- 机器绑定系统

### 9.2 原因

因为当前真正需要的是：

> 用户有没有资格进入系统并使用小说产品

而不是：

> 这台设备是否被永久授权运行桌面端

---

## 10. 后续 AI 在参考项目中应该优先阅读的索引

下面是新工作区里应该优先阅读的文件和它们的作用。

---

## 11. 参考项目 `new-api-main` 的关键索引

> 项目路径：`N:\mojinxiezuo-os-master\参考项目\new-api-main`

### 11.1 顶层定位文档

#### `AGENTS.md`
用途：项目架构和约定入口

关键信息：

- 这是 AI 网关 / 聚合平台
- 技术栈：Go + Gin + GORM + React
- 架构分层：Router -> Controller -> Service -> Model
- Auth：JWT、WebAuthn/Passkeys、OAuth

为什么要先看：

- 能快速理解整个参考项目本质不是普通网站，而是“AI Gateway + 用户后台”

---

#### `README.md`
用途：官方定位、能力边界、部署方式

关键信息：

- 官方定位是 `Next-Generation LLM Gateway and AI Asset Management System`
- 支持支付、权限、OAuth、多模型网关
- 许可证为 AGPLv3

为什么要先看：

- 明确这不是原生的“软件授权中心”，只是适合作为账号/网关基座

---

#### `LICENSE`
用途：确认授权与合规边界

关键结论：

- AGPLv3

为什么要先看：

- 如果后续团队对部署、二开、闭源有要求，必须提前评估合规风险

---

### 11.2 路由入口

#### `router/api-router.go`
用途：定位所有后台 API 路由

重点关注的现有路由族：

- `/api/user/register`
- `/api/user/login`
- `/api/user/login/2fa`
- `/api/user/passkey/*`
- `/api/oauth/*`
- `/api/redemption/*`
- `/api/subscription/*`
- `/api/user/self`
- `/api/user/*`（管理员）

为什么要重点看：

- 后续“注册码参与注册”最可能要从这里的注册入口开始改
- 后续新加“注册码管理接口”也可参考这里的分组风格

---

### 11.3 注册 / 登录核心实现

#### `controller/user.go`
用途：注册、登录、自助用户操作核心逻辑

重点函数：

- `func Login(c *gin.Context)`
- `func Register(c *gin.Context)`
- `func TopUp(c *gin.Context)`

为什么要重点看：

- `Register` 是后续增加 `registration_code` 字段与校验流程的第一核心改造点
- `TopUp` 调用了 `model.Redeem(...)`，可用来理解“兑换码”在本项目中本质是充值额度，而不是产品 license

---

### 11.4 用户模型与用户能力

#### `model/user.go`
用途：用户表结构、用户插入、邀请收益、额度等逻辑

重点内容：

- `type User struct`
- 新用户配额赠送逻辑
- 邀请相关字段（如 `AffCode`, `InviterId` 等）
- AccessToken 与用户状态能力

为什么要重点看：

- 如果后续要把“注册码开通小说产品”落到用户上，需要判断：
  - 是直接加字段到 `User`
  - 还是新建 `entitlement` 表

---

### 11.5 兑换码系统

#### `model/redemption.go`
用途：理解参考项目已有“兑换码”模型

关键事实：

- `type Redemption struct`
- `Redeem(key, userId)` 的作用是给 `User.quota` 加值
- 它不是设备授权，也不是桌面激活

为什么要重点看：

- 可以复用它的“码生成 / 过期 / 已使用 / 状态管理”的模式
- 但不要直接把它原样当小说产品注册码使用，除非你明确决定“注册码 = 一次性开通资格码”并重新定义其含义

---

### 11.6 配置中心

#### `model/option.go`
#### `common/constants.go`

用途：全局开关、站点能力控制

重点内容：

- `RegisterEnabled`
- `PasswordRegisterEnabled`
- `EmailVerificationEnabled`
- `GitHubOAuthEnabled`
- `TelegramOAuthEnabled`
- `QuotaForNewUser`
- `QuotaForInviter`
- `QuotaForInvitee`

为什么要重点看：

- 后续如果要做“是否强制注册码注册”的站点开关，非常适合按这里的模式新增一个全局配置项，例如：
  - `RegistrationCodeRequired`
  - `NovelProductEnabled`

---

### 11.7 站点状态输出

#### `controller/misc.go`
用途：前端读取站点配置开关

重点函数：

- `func GetStatus(c *gin.Context)`

为什么要重点看：

- 如果前端注册页需要知道“当前是否强制注册码”或“当前小说产品入口是否开放”，可以按此函数输出状态字段

---

### 11.8 Passkey / 2FA / OAuth

#### `controller/passkey.go`
#### `controller/twofa.go`
#### `oauth/`

用途：如果后续保留这些高级账号能力，可以直接沿用

为什么要重点看：

- 说明参考项目已经具备完整账号中心的增强能力，不需要重造一遍

---

### 11.9 订阅系统

#### `controller/subscription.go`
#### `model/` 中 subscription 相关文件
#### `web/src/components/table/subscriptions/*`

用途：理解“权益/订阅”的现有模式

为什么要重点看：

- 如果未来把“小说产品资格”做成 plan/subscription，也可基于这里演进
- 但 MVP 阶段不建议先走订阅制，先用注册码控制准入更简单

---

## 12. 参考项目前端的关键索引

### 12.1 注册页 / 登录页相关

建议在 `web/src` 中检索：

- `RegisterForm`
- `LoginForm`
- `OAuth2Callback`
- `Passkey`
- `AccountManagement`

已定位的部分参考组件：

- `web/src/components/auth/RegisterForm.jsx`
- `web/src/components/auth/LoginForm.jsx`
- `web/src/components/auth/OAuth2Callback.jsx`
- `web/src/components/settings/personal/cards/AccountManagement.jsx`

为什么要看：

- 后续如果要在注册页加入 `注册码输入框`，大概率需要从这里切入

---

### 12.2 兑换码管理后台

已定位的部分文件：

- `web/src/components/table/redemptions/*`
- `web/src/hooks/redemptions/useRedemptionsData.jsx`
- `web/src/components/topup/RechargeCard.jsx`

为什么要看：

- 可以直接参考它的后台列表、批量创建、编辑、删除、状态展示的 UI 设计
- 后续“注册码管理后台”完全可以仿照一套相似结构做出来

---

## 13. 当前小说主项目的关键索引（仅供集成方参考，不是本轮主改造对象）

> 项目路径：`N:\mojinxiezuo-os-master`

### 13.1 总体架构

#### `ARCHITECTURE.md`
用途：理解小说项目当前请求流和工作区结构

关键事实：

- 前端进入 `frontend/app/`
- Workspace 当前大量依赖匿名 `X-Workspace-Id`
- 已有 auth 路由与 JWT 中间件分流

---

#### `CONVENTIONS.md`
用途：理解层次边界与契约规则

关键事实：

- 后端遵循 handler/service/repository/model 分层
- 前端只读 Go backend BFF
- API 合同以 `api/openapi.yaml` 为准

---

### 13.2 当前账号相关现状

#### `docs/API_GUIDE.md`
关键事实：

当前已有：

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/profile`

说明：

- 当前主项目并非完全没有账号能力
- 但这些能力不建议继续演化为长期正式线上账号中心

---

#### `frontend/stores/auth.ts`
用途：前端 token 状态管理

说明：

- 后续如果小说主项目接入外部统一身份中心，这里的实现可能只保留为消费 token 的本地状态层，而非身份中心本身

---

### 13.3 当前桌面激活设计（仅说明未来边界）

#### `docs/DESKTOP_ACTIVATION_BACKEND.md`
关键事实：

当前小说项目已经设计了未来桌面激活合同，包括：

- `development / unactivated / active / expired / revoked / mismatch / damaged / degraded`
- 激活 / 复核 / reset 的稳定接口外形
- future admin placeholder

说明：

- 这说明当前主项目未来**确实可能需要真正的桌面 License 系统**
- 但这不是本轮 MVP 的主目标

---

## 14. 在参考项目中最推荐的新数据模型（MVP 建议）

下面是**建议**，不是当前仓库已存在实现。

### 14.1 方案推荐：不要把产品资格硬塞进 `User` 表，优先独立建表

#### 表 1：`registration_codes`

用于注册前置校验 / 开通资格码

建议字段：

- `id`
- `code`
- `name`
- `status`（enabled / disabled / used / expired）
- `product_key`（例如 `novel_product`）
- `expires_at`
- `max_uses`
- `used_count`
- `created_by`
- `created_at`
- `updated_at`

#### 表 2：`registration_code_usages`

用于审计谁用了哪个注册码

建议字段：

- `id`
- `registration_code_id`
- `user_id`
- `used_at`
- `ip`
- `notes`

#### 表 3：`user_product_entitlements`

用于表达“用户是否拥有某产品资格”

建议字段：

- `id`
- `user_id`
- `product_key`（如 `novel_product`）
- `status`（active / disabled / revoked / expired）
- `source_type`（registration_code / admin_grant / subscription）
- `source_id`
- `granted_at`
- `expires_at`
- `notes`

---

## 15. 为什么推荐单独建 `entitlement` 表，而不是只给 `User` 加一个布尔字段

### 15.1 布尔字段的优点

- 开发快
- MVP 简单

例如直接给 `User` 加：

- `novel_enabled bool`

### 15.2 但更推荐独立建表的原因

因为后面非常可能扩展为：

- 一个用户可拥有多个产品
- 产品资格可能来自注册码、管理员发放、订阅购买
- 资格可能有过期时间
- 资格可能需要审计来源

因此长期更推荐：

- `user_product_entitlements`

### 15.3 最终建议

- 若追求最短 MVP：可先布尔字段
- 若希望后续少返工：直接上 `entitlement` 表

**推荐：直接上 `entitlement` 表。**

---

## 16. 在参考项目中最推荐的新 API（MVP 建议）

### 16.1 注册侧 API

#### 方案 A：直接扩展现有注册接口（最省事）

扩展：

- `POST /api/user/register`

新增字段：

- `registration_code`

注册流程：

1. 校验注册码
2. 有效才允许创建用户
3. 创建用户后授予 `novel_product` 资格
4. 写 usage 审计

> 这是最推荐的 MVP 做法。

---

#### 方案 B：先验码，再注册（更干净）

新增：

- `POST /api/registration-code/validate`

作用：

- 用户先校验注册码是否可用
- 通过后再进入正式注册

说明：

- 结构更干净
- 但实现比直接扩展注册接口略复杂

---

### 16.2 后台管理 API

建议新增：

- `GET /api/registration-code`
- `GET /api/registration-code/:id`
- `POST /api/registration-code`
- `PUT /api/registration-code`
- `DELETE /api/registration-code/:id`
- `GET /api/registration-code/usage`

> 路由风格可直接参考 `redemption` 管理接口。

---

### 16.3 用户资格 API

建议新增：

- `GET /api/user/self/entitlements`

返回示例语义：

```json
{
  "novel_product": {
    "status": "active",
    "source_type": "registration_code",
    "granted_at": 1710000000,
    "expires_at": 0
  }
}
```

说明：

- 后续小说主项目只需要消费这类结果，而不关心注册码细节

---

## 17. 后续 AI 在参考项目中建议优先修改的代码位置

### 17.1 第一步：改注册接口

优先看：

- `router/api-router.go`
- `controller/user.go`
- `model/user.go`

目标：

- 给注册流程加入注册码校验

### 17.2 第二步：新增注册码模型与后台接口

可仿照：

- `model/redemption.go`
- `controller` 里 redemption 管理相关实现
- `router/api-router.go` 中 `redemptionRoute`
- `web/src/components/table/redemptions/*`

目标：

- 最快做出一套注册码管理后台

### 17.3 第三步：新增用户产品资格读取能力

建议修改：

- `model/user.go` 或新增 entitlement model
- `controller/user.go` 或新增 controller
- `router/api-router.go`

目标：

- 让外部系统可以拿到“这个用户是否具备小说产品资格”的正式结果

---

## 18. 对“是否直接复用 Redemption 模型”的建议

### 18.1 可以参考它的机制

`redemption` 里现成有：

- 码
- 状态
- 过期时间
- 使用记录
- 后台管理 UI 结构

这些都非常值得参考。

### 18.2 但不建议直接不改语义硬用

因为当前 `redemption` 的含义是：

- 兑换额度 / quota

而不是：

- 注册准入
- 产品资格开通

### 18.3 推荐方式

**参考实现，不直接复用语义。**

也就是说：

- 可以参考 `redemption` 的代码结构
- 但新增一个更明确的新模型，例如：
  - `RegistrationCode`
  - `UserProductEntitlement`

---

## 19. 对“AI 供应能力”的处理建议

### 19.1 当前现实

你们当前已经在使用参考项目的 AI 聚合能力。

这意味着：

- 参考项目不仅是账号系统
- 它同时还是 AI 网关层

### 19.2 所以后续改造方向不是“纯注册网站”

而是：

- 账号中心
- 准入中心
- AI 网关中心

三者合一。

### 19.3 小说主项目与 AI 的关系

小说主项目在未来应该被理解为：

- 业务前台 / 创作工作台
- 它自己不负责上游供应商聚合
- 它从“统一入口中心”获取 AI 能力

---

## 20. 当前方案下，小说主项目未来最小接入职责

虽然本轮主改造对象不是小说主项目，但后续对接时，它至少需要具备这些能力：

1. 能识别统一入口中心给出的用户身份
2. 能知道当前用户是否拥有 `novel_product` 资格
3. 能在需要 AI 时走统一入口中心的网关能力

说明：

- 小说主项目不是“完全不改”
- 而是“不再做账号中心，只做消费方”

---

## 21. 对后续新工作区 AI 的执行建议

### 21.1 建议工作顺序

#### Step 1. 只做后端 MVP
先在 `new-api` 后端完成：

- 注册码模型
- 注册码校验
- 注册时强制带注册码
- 用户资格写入
- 后台注册码 CRUD

#### Step 2. 再做前端注册页与后台页

- 注册页增加 `注册码` 输入框
- 后台新增注册码管理页面

#### Step 3. 再补对外资格查询接口

- `GET /api/user/self/entitlements`

#### Step 4. 最后才考虑小说主项目接入

不要在第一轮就同时改两个项目，容易失控。

---

## 22. 验证建议（给后续新工作区 AI）

### 22.1 最小验证链路

至少要验证：

1. 无注册码时注册失败
2. 非法注册码注册失败
3. 已过期注册码注册失败
4. 有效注册码注册成功
5. 注册成功后用户拥有 `novel_product` 资格
6. 同一一次性注册码不能被重复使用
7. 管理后台可创建/禁用/查看注册码

### 22.2 如果要做集成前验证

还应验证：

- 登录后读取资格接口是否正确
- 前端注册页是否能正确展示“请输入注册码”与错误提示

---

## 23. 风险与限制

### 23.1 合规风险

参考项目 `new-api` 使用 AGPLv3。

这意味着：

- 如果后续团队对闭源、商用部署有要求，需要提前评估许可影响
- 本文档只做工程提醒，不构成法律建议

### 23.2 语义风险

不要把：

- quota 兑换码
- 注册准入码
- 桌面 license 激活码

混成一个概念。

当前 MVP 应收敛为：

- 注册准入码 / 开通码

### 23.3 架构风险

不要在小说主项目和参考项目中长期保留两套正式线上账号体系。

---

## 24. 给后续执行者的最终指令摘要

如果你是后续在新工作区接手的 AI，请按下面方式理解任务：

### 24.1 你本轮真正要做的事情

在 `参考项目/new-api-main` 上做一轮最小但可上线的产品化改造，使它成为：

- 小说产品的统一注册/登录入口
- 注册码/邀请码/开通码中心
- AI 网关入口
- 小说产品资格中心

### 24.2 你本轮不要做的事情

- 不要先去改小说主项目主线业务
- 不要先做桌面设备级 License 激活系统
- 不要让当前小说主项目继续生长成另一套正式线上账号中心

### 24.3 你最该先读的文件顺序

#### 在 `new-api-main` 中：
1. `AGENTS.md`
2. `README.md`
3. `LICENSE`
4. `router/api-router.go`
5. `controller/user.go`
6. `model/user.go`
7. `model/redemption.go`
8. `model/option.go`
9. `common/constants.go`
10. `controller/misc.go`
11. `web/src/components/auth/*`
12. `web/src/components/table/redemptions/*`

#### 仅作集成边界参考，在小说主项目中：
1. `ARCHITECTURE.md`
2. `CONVENTIONS.md`
3. `docs/API_GUIDE.md`
4. `frontend/stores/auth.ts`
5. `docs/DESKTOP_ACTIVATION_BACKEND.md`

---

## 25. 本文档的最终落地建议（务实版本）

如果后续开发者只想选一个**最省事**的方案，请直接按下面做：

### 推荐务实版 MVP

- 在 `new-api` 注册接口中新增 `registration_code`
- 新建 `registration_codes` 与 `user_product_entitlements` 两张表
- 注册时必须校验 `registration_code`
- 校验通过才允许创建用户
- 注册成功后给用户授予 `novel_product` 资格
- 前端注册页增加一个“注册码”输入框
- 后台新增“注册码管理”页面（直接参考 redemption 管理页）

这套做完，已经足够支撑：

- 统一入口注册
- 准入控制
- 用户开通小说产品资格
- 后续主项目接入

而无需先做复杂 License 系统。

---

## 26. 本文档状态

- 生成日期：2026-04-05
- 生成背景：在当前小说主项目工作区内完成需求澄清与架构收口
- 后续实施位置：**另一个新工作区**，以 `参考项目/new-api-main` 为主改造对象
- 当前仓库本轮不继续实施账号系统改造

