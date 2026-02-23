#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
//  push-assignment.js
//  Run this from your sales-eq-app folder on the Linux laptop:
//
//    node push-assignment.js my-assignment-file.json
//
//  It will POST the assignment directly to saleseqcoach.com
//  and it will appear in your dashboard instantly.
// ─────────────────────────────────────────────────────────────

const fs   = require('fs')
const path = require('path')
const https = require('https')

// ── Config ────────────────────────────────────
const SITE_URL  = 'https://saleseqcoach.com'
const ADMIN_KEY = process.env.SALESEQ_ADMIN_KEY || ''

if (!ADMIN_KEY) {
  console.error('\n❌  Missing SALESEQ_ADMIN_KEY environment variable.')
  console.error('    Run: export SALESEQ_ADMIN_KEY=your-admin-key\n')
  process.exit(1)
}

// ── Get file from args ────────────────────────
const file = process.argv[2]
if (!file) {
  console.error('\n❌  Usage: node push-assignment.js <assignment.json>\n')
  process.exit(1)
}

const filePath = path.resolve(file)
if (!fs.existsSync(filePath)) {
  console.error(`\n❌  File not found: ${filePath}\n`)
  process.exit(1)
}

// ── Read and validate ─────────────────────────
let assignment
try {
  const raw = fs.readFileSync(filePath, 'utf8')
  assignment = JSON.parse(raw)
} catch (e) {
  console.error(`\n❌  Invalid JSON: ${e.message}\n`)
  process.exit(1)
}

if (!assignment.slug) {
  console.error('\n❌  Assignment JSON must have a "slug" field.\n')
  process.exit(1)
}

// ── Push to API ───────────────────────────────
const body = JSON.stringify(assignment)
const url  = new URL('/api/assignments', SITE_URL)

const options = {
  hostname: url.hostname,
  path:     url.pathname,
  method:   'POST',
  headers:  {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(body),
    'x-api-key':      ADMIN_KEY,
  }
}

console.log(`\n⏳  Pushing "${assignment.title}" (/${assignment.slug}) to ${SITE_URL}…`)

const req = https.request(options, res => {
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log(`\n✅  Done! View at: ${SITE_URL}/${assignment.slug}`)
      console.log(`    Dashboard:    ${SITE_URL}/dashboard\n`)
    } else {
      console.error(`\n❌  Server error ${res.statusCode}: ${data}\n`)
    }
  })
})

req.on('error', e => console.error(`\n❌  Request failed: ${e.message}\n`))
req.write(body)
req.end()
