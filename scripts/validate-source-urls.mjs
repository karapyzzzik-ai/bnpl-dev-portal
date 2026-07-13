import { readFileSync } from 'node:fs'

const urls = JSON.parse(readFileSync('data/source-urls.json', 'utf-8'))

if (!Array.isArray(urls) || urls.length === 0) {
  console.error('FAIL: source-urls.json is empty or not an array')
  process.exit(1)
}

const badUrl = urls.find(u => typeof u !== 'string' || !u.startsWith('https://bnpl.kz/dev-portal'))
if (badUrl) {
  console.error(`FAIL: unexpected URL in list: ${badUrl}`)
  process.exit(1)
}

console.log(`OK: ${urls.length} URLs, all under https://bnpl.kz/dev-portal`)
