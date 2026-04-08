# brainstorm: 账号管理中间层方案

## Goal

为小说主项目设计一个独立的“账号/授权中间层项目”，复用参考项目 new-api 中相对成熟的注册、登录、OAuth、2FA、Passkey、兑换码、后台配置与管理能力，同时把小说业务继续保持在当前仓库中，避免把小说业务耦合进 new-api。

## What I already know

- 当前小说项目并非完全没有账号能力：已有 users 表、登录/注册页、token 持久化、JWT 鉴权中间件。
- 当前小说主工作流仍以匿名工作区 `X-Workspace-Id` 为主，正式账号化工作区尚未完全收口。
- 当前小说项目还存在一套“桌面授权/激活”设计与后端语义，但远端发码/吊销/运营后台并未真正落地。
- 参考项目 new-api 已具备：注册/登录、邮箱验证、OAuth、多因素认证、Passkey、用户管理、Root/Admin 配置、Token 管理、支付与兑换码充值、订阅能力。
- new-api 的兑换码本质是“充值额度（quota）”而不是“桌面软件许可证激活码”。
- new-api 官方定位是“LLM Gateway / AI Asset Management System”，不是专门的软件 license server。

## Assumptions (temporary)

- 用户真正想要的不是把小说业务搬进 new-api，而是把“账号体系 + 运营后台 + 兑换码/授权运营能力”独立出去。
- 中间层项目需要成为统一身份与授权中心，小说项目只消费其用户身份与授权结果。
- 如果要做桌面软件激活，建议在中间层新增 license 子系统，而不是直接复用 new-api 的兑换码表语义。

## Open Questions

- MVP 第一阶段是否只接入“账号登录 + 用户同步 + 兑换码权益映射”，暂不做桌面机器绑定激活？
- new-api 在你这里是仅作“参考实现”，还是允许直接 fork / 二开 / 持续升级？
- 小说项目最终是 Web 为主，还是 Desktop 授权会成为第一优先级？

## Requirements (evolving)

- 保持小说项目业务纯粹，不把运营后台、支付、兑换码管理直接塞进主仓库。
- 提供独立的账号与授权中间层。
- 中间层应能复用或参考 new-api 的成熟账号管理能力。
- 小说项目只信任中间层给出的身份与授权结果。
- 需要能区分“充值兑换码”和“产品激活码/许可证”。

## Acceptance Criteria (evolving)

- [ ] 明确 current-state / target-state 架构边界
- [ ] 明确哪些能力可直接复用 new-api，哪些必须新建
- [ ] 明确小说项目与中间层之间的认证/授权数据流
- [ ] 明确桌面激活是否单独建 license 子系统
- [ ] 输出分阶段落地路线（MVP → 正式版）

## Definition of Done (team quality bar)

- 方案边界清楚
- 风险、限制、验证缺口明确
- 能拆成后续实现任务
- 对 new-api 复用边界和法律/维护风险有明确说明

## Out of Scope (explicit)

- 本轮不直接修改主项目业务代码
- 本轮不直接实现中间层项目
- 本轮不做支付渠道选型落地
- 本轮不承诺 new-api 可无改造直接承担桌面 license server 职责

## Technical Notes

- 小说项目事实来源：ARCHITECTURE.md, CONVENTIONS.md, .trellis/workflow.md, docs/API_GUIDE.md, docs/DESKTOP_ACTIVATION_BACKEND.md, frontend/stores/auth.ts, backend migrations/users
- new-api 本地事实来源：router/api-router.go, model/user.go, model/redemption.go, model/option.go, controller/user.go, controller/misc.go
- 官方联网核验（2026-04-05）：
  - GitHub README: QuantumNous/new-api
  - docs.newapi.pro 用户模块 / OAuth 模块 / 站点配置模块 / 鉴权说明
- 初步判断：
  - new-api 适合做“账号与运营能力参考/基座”
  - new-api 不适合原样充当“小说产品 license 激活中心”
  - 最合理方向是“账号/授权中心（Auth Hub） + 小说业务项目”双系统架构
