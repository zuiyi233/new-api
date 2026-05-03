const fs = require('fs')
const path = require('path')
const roots = [
  'N:/new-api-main/web/default/src/features/midjourney',
  'N:/new-api-main/web/default/src/features/order-claim',
  'N:/new-api-main/web/default/src/features/registration-codes',
  'N:/new-api-main/web/default/src/features/subscription-codes',
  'N:/new-api-main/web/default/src/features/code-center',
  'N:/new-api-main/web/default/src/features/code-publication',
  'N:/new-api-main/web/default/src/features/order-claim-admin',
]
const files = ['N:/new-api-main/web/default/src/hooks/use-sidebar-data.ts']
function walk(dir) {
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(p)) files.push(p)
  }
}
for (const r of roots) walk(r)
const keys = new Set()
const patterns = [/t\(\s*'([^']+)'/g, /t\(\s*\"([^\"]+)\"/g]
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  for (const re of patterns) {
    let m
    while ((m = re.exec(s))) keys.add(m[1])
  }
}
const zh = JSON.parse(fs.readFileSync('N:/new-api-main/web/default/src/i18n/locales/zh.json', 'utf8')).translation
const missing = [...keys].filter((k) => !(k in zh)).sort()
console.log('FILES', files.length)
console.log('TOTAL_KEYS', keys.size)
console.log('MISSING_ZH', missing.length)
for (const k of missing) console.log(k)
