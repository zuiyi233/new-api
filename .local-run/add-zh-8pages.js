const fs = require('fs')
const path = require('path')
const featureRoots = [
  'N:/new-api-main/web/default/src/features/midjourney',
  'N:/new-api-main/web/default/src/features/order-claim',
  'N:/new-api-main/web/default/src/features/registration-codes',
  'N:/new-api-main/web/default/src/features/subscription-codes',
  'N:/new-api-main/web/default/src/features/code-center',
  'N:/new-api-main/web/default/src/features/code-publication',
  'N:/new-api-main/web/default/src/features/order-claim-admin',
]
const sidebarFile = 'N:/new-api-main/web/default/src/hooks/use-sidebar-data.ts'
const localePath = 'N:/new-api-main/web/default/src/i18n/locales/zh.json'

function walkTsFiles(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walkTsFiles(p, out)
    else if (/\.(ts|tsx)$/.test(p)) out.push(p)
  }
}

const files = [sidebarFile]
for (const root of featureRoots) walkTsFiles(root, files)

const patterns = [/\bt\(\s*'([^']+)'/g, /\bt\(\s*\"([^\"]+)\"/g]
const keys = new Set()
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8')
  for (const re of patterns) {
    let m
    while ((m = re.exec(content))) {
      keys.add(m[1])
    }
  }
}

const skip = new Set([
  '1 Month',
  'Click save when you\'re done.',
  'Cancel',
  'Saving...',
  'Create',
  'Update',
  'Delete',
  'Deleting...',
  'Are you sure?',
  '. This action cannot be undone.',
  'Status',
  'Enabled',
  'Disabled',
  'Product',
  'No records found. Try adjusting your filters.',
  'No Data',
  'Filter...',
  'Name',
  'ID',
  'Code',
  'Channel',
  'Created',
  'Expires',
  'Select',
  'Select all',
  'Select row',
  'Open menu',
  'Edit',
  'View',
  'Delete selected',
  'Enable',
  'Disable',
  'Unlimited',
  'Never',
  'Expired',
  'Exhausted',
  'Copied',
  'Copy failed',
  'Submitting...',
  'Loading...',
  'Reviewer',
  'Review',
  'Reset',
])

const filtered = [...keys].filter((k) => !skip.has(k))
const zhData = JSON.parse(fs.readFileSync(localePath, 'utf8'))
const translation = zhData.translation || {}
const added = []

function zhValue(key) {
  const map = {
    'Midjourney Logs': '绘图日志',
    'Order Claim': '订单申领',
    'Registration Codes': '注册码管理',
    'Subscription Codes': '订阅码管理',
    'Code Center': '码中心',
    'Code Publication': '码发放',
    'Order Claims Management': '订单申领管理',
    'Admin view for all Midjourney tasks': '管理员视角：查看全部 Midjourney 任务',
    'Your Midjourney task history': '你的 Midjourney 任务历史',
    'Filter by Task ID...': '按任务 ID 筛选...',
    'No Midjourney logs found': '暂无绘图日志',
    'No Midjourney image generation logs yet.': '暂无 Midjourney 出图记录。',
    'Manage registration codes for user registration': '管理用于用户注册的注册码',
    'Manage subscription codes for user subscriptions': '管理用于用户订阅的订阅码',
    'Filter registration codes...': '筛选注册码...',
    'Filter subscription codes...': '筛选订阅码...',
    'No registration codes found': '暂无注册码',
    'No subscription codes found': '暂无订阅码',
    'Create your first registration code to get started.': '创建第一个注册码即可开始。',
    'Create your first subscription code to get started.': '创建第一个订阅码即可开始。',
    'No code': '暂无代码',
    'Product Key': '产品标识',
    'Batch No': '批次号',
    'Campaign Name': '活动名称',
    'Count': '数量',
    'Create Registration Code': '创建注册码',
    'Create Subscription Code': '创建订阅码',
    'Update Registration Code': '更新注册码',
    'Update Subscription Code': '更新订阅码',
    'A descriptive name for this registration code.': '为该注册码设置一个便于识别的名称。',
    'A descriptive name for this subscription code.': '为该订阅码设置一个便于识别的名称。',
    'Enter code name': '输入代码名称',
    'Select product': '选择产品',
    'The product this code grants access to.': '该代码可授予访问的产品。',
    'Max Uses': '最大可用次数',
    'Enter max uses': '输入最大可用次数',
    'Maximum number of times this code can be used. 0 for unlimited.': '该代码最多可使用次数，0 表示不限次数。',
    'Enter batch number': '输入批次号',
    'Enter campaign name': '输入活动名称',
    'Enter channel': '输入渠道',
    'Source Platform': '来源平台',
    'Enter source platform': '输入来源平台',
    'External Order No': '外部订单号',
    'External Order Number': '外部订单号',
    'Enter external order number': '输入外部订单号',
    'Expiration Date': '过期时间',
    'Pick an expiration date': '选择过期时间',
    '3 Months': '3 个月',
    '6 Months': '6 个月',
    '1 Year': '1 年',
    'Enter count': '输入数量',
    'Number of codes to generate in this batch.': '本批次要生成的代码数量。',
    'Add new registration code(s) by providing necessary info.': '填写必要信息后新增注册码。',
    'Add new subscription code(s) by providing necessary info.': '填写必要信息后新增订阅码。',
    'Update the registration code by providing necessary info.': '填写必要信息后更新注册码。',
    'Update the subscription code by providing necessary info.': '填写必要信息后更新订阅码。',
    'Successfully created {{count}} registration codes': '成功创建 {{count}} 个注册码',
    'Successfully created {{count}} subscription codes': '成功创建 {{count}} 个订阅码',
    'This will permanently delete registration code': '将永久删除注册码',
    'This will permanently delete subscription code': '将永久删除订阅码',
    'View Usage': '查看使用记录',
    'Copy selected codes': '复制所选代码',
    'Codes copied!': '代码已复制！',
    'Enable selected': '启用所选项',
    'Disable selected': '禁用所选项',
    'Delete selected': '删除所选项',
    'Export selected': '导出所选项',
    'No registration codes selected': '未选择注册码',
    'No subscription codes selected': '未选择订阅码',
    'Selected registration codes exported successfully': '已成功导出所选注册码',
    'Selected subscription codes exported successfully': '已成功导出所选订阅码',
    'registration code': '注册码',
    'subscription code': '订阅码',
    'Create Code': '创建代码',
    'Import CSV': '导入 CSV',
    'History': '历史记录',
    'Batch Summary': '批次汇总',
    'Export current page': '导出当前页',
    'No registration codes to export': '当前没有可导出的注册码',
    'No subscription codes to export': '当前没有可导出的订阅码',
    'Registration codes exported successfully': '注册码导出成功',
    'Subscription codes exported successfully': '订阅码导出成功',
    'Overview of all registration and subscription codes': '注册码与订阅码总体概览',
    'Total': '总数',
    'Code Publication': '码发放',
    'Manage publication records and apply reissue, revoke, and rollback actions': '管理发放记录并执行补发、撤销、回滚操作',
    'Publication List': '发放列表',
    'No publications yet.': '暂无发放记录。',
    'Selected': '已选中',
    'Select': '选择',
    'Detail': '详情',
    'Publication Action': '发放操作',
    'Selected publication #{{id}}': '已选发放记录 #{{id}}',
    'Select a publication from the list first': '请先从列表选择一条发放记录',
    'Action': '操作',
    'Reissue': '补发',
    'Revoke': '撤销',
    'Rollback': '回滚',
    'Delivery Channel': '发放渠道',
    'Optional delivery channel': '可选发放渠道',
    'Revoke Reason': '撤销原因',
    'Required for revoke action': '执行撤销时必填',
    'Notes': '备注',
    'Optional notes': '可选备注',
    'Applying...': '执行中...',
    'Apply Action': '执行操作',
    'Action applied successfully': '操作执行成功',
    'Action failed': '操作执行失败',
    'Revoke reason is required': '撤销原因必填',
    'Publication Detail': '发放详情',
    'Deliveries and operation logs for selected publication': '所选发放记录的发放明细与操作日志',
    'Select a publication first.': '请先选择一条发放记录。',
    'Loading detail...': '详情加载中...',
    'Order Claim': '订单申领',
    'Submit your external order information for manual claim review': '提交外部订单信息，进入人工审核申领',
    'Claim Code': '申领码',
    'Buyer Contact': '购买者联系方式',
    'Enter buyer contact': '输入购买者联系方式',
    'Claimed Product': '申领产品',
    'Enter claimed product': '输入申领产品',
    'Claim Note': '申领备注',
    'Optional claim note': '可选申领备注',
    'Proof Image URLs': '凭证图片链接',
    'One URL per line': '每行一个链接',
    'Submit Claim': '提交申领',
    'Order claim submitted successfully!': '订单申领提交成功！',
    'My Claims': '我的申领记录',
    'No claims yet.': '暂无申领记录。',
    'Grant Type': '发放类型',
    'Review Note': '审核备注',
    'Proof {{index}}': '凭证 {{index}}',
    'Order Claims Management': '订单申领管理',
    'Review external order claims and grant subscription, registration, or redemption assets': '审核外部订单申领并发放订阅、注册码或兑换码资产',
    'Filter claims...': '筛选申领记录...',
    'No claims found': '未找到申领记录',
    'No order claims have been made yet.': '当前还没有任何订单申领。',
    'Review': '审核',
    'View Order Claim': '查看订单申领',
    'Review Order Claim': '审核订单申领',
    'Claim details, proof references, and review action form': '申领详情、凭证引用与审核表单',
    'Claim ID': '申领 ID',
    'User ID': '用户 ID',
    'Reviewer ID': '审核人 ID',
    'Proof Images': '凭证图片',
    'Reviewed At': '审核时间',
    'Submit Review': '提交审核',
    'Approve': '通过',
    'Reject': '拒绝',
    'Review submitted': '审核已提交',
    'Generated code copied to clipboard': '生成的代码已复制到剪贴板',
    'Generated code copy failed': '生成代码复制失败',
    'Select plan': '选择套餐',
    'Grant Name': '发放名称',
    'Optional grant name': '可选发放名称',
    'Grant Note': '发放备注',
    'Optional grant note': '可选发放备注',
    'Product Key': '产品标识',
    'Redemption': '兑换码',
    'Registration Code': '注册码',
    'Subscription Code': '订阅码',
    'Expires At': '过期时间',
    'Optional review note': '可选审核备注',
  }
  if (Object.prototype.hasOwnProperty.call(map, key)) return map[key]
  return null
}

for (const key of filtered) {
  if (Object.prototype.hasOwnProperty.call(translation, key)) continue
  const value = zhValue(key)
  if (!value) continue
  translation[key] = value
  added.push(key)
}

const sorted = Object.keys(translation)
  .sort((a, b) => a.localeCompare(b))
  .reduce((acc, key) => {
    acc[key] = translation[key]
    return acc
  }, {})
zhData.translation = sorted
fs.writeFileSync(localePath, JSON.stringify(zhData, null, 2) + '\n')
console.log('ADDED', added.length)
for (const key of added) console.log(key)
