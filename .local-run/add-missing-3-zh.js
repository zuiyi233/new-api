const fs = require('fs')
const p = 'N:/new-api-main/web/default/src/i18n/locales/zh.json'
const data = JSON.parse(fs.readFileSync(p, 'utf8'))
const t = data.translation || {}
const add = {
  'Delete selected': '删除所选项',
  'Granted Code': '发放代码',
  'Review': '审核',
}
let count = 0
for (const [k, v] of Object.entries(add)) {
  if (!(k in t)) {
    t[k] = v
    count++
  }
}
const sorted = Object.keys(t)
  .sort((a, b) => a.localeCompare(b))
  .reduce((acc, key) => {
    acc[key] = t[key]
    return acc
  }, {})
data.translation = sorted
fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n')
console.log('ADDED', count)
