import { readFileSync, existsSync } from 'node:fs'

const expected = JSON.parse(readFileSync('data/expected-facts.json', 'utf-8'))
let failures = 0

for (const [file, facts] of Object.entries(expected)) {
  if (!existsSync(file)) {
    console.error(`FAIL: missing file ${file}`)
    failures++
    continue
  }
  const text = readFileSync(file, 'utf-8')
  for (const fact of facts) {
    if (!text.includes(fact)) {
      console.error(`FAIL: ${file} is missing expected fact: "${fact}"`)
      failures++
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} content parity failure(s)`)
  process.exit(1)
}
console.log(`OK: all ${Object.keys(expected).length} files contain their expected facts`)
