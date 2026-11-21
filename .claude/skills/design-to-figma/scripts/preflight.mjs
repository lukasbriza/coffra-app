#!/usr/bin/env node
// Checks everything /design needs before the pipeline starts, and prints the exact fix for
// anything missing. Exits 1 when a REQUIRED item is missing, so the command can stop.
//
//   node .claude/skills/design-to-figma/scripts/preflight.mjs [--json]
//
// Run from the repo root. Reads nothing outside the repo except the browser/tool locations
// it is looking for. Installs nothing.

/* eslint-disable no-console, turbo/no-undeclared-env-vars --
   Standalone CLI script, not a turbo task: console is its output, env vars are OS lookups. */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

import { findChrome } from './lib/find-chrome.mjs'

const { join, relative, resolve } = path

const WIN = process.platform === 'win32'
const MAC = process.platform === 'darwin'
const json = process.argv.includes('--json')
const checks = []

const add = (group, name, ok, detail, fix) => checks.push({ group, name, ok, detail, fix })

const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- required: runtime
const major = Number(process.versions.node.split('.', 1)[0])
add(
  'required',
  'Node 22+',
  major >= 22,
  `v${process.versions.node}`,
  'install Node 22 or newer (.nvmrc pins the version)',
)

const python = ['python3', 'python', 'py']
  .map((bin) => ({ bin, out: run(bin, ['--version']) }))
  .find((r) => r.out?.startsWith('Python 3'))
add(
  'required',
  'Python 3 (phase 3 server)',
  Boolean(python),
  python ? `${python.bin} — ${python.out}` : 'not found',
  WIN
    ? 'install from python.org, or use any static server and adjust the phase 3 command'
    : 'install python3, or use any static server and adjust the phase 3 command',
)

const chrome = findChrome()
add(
  'required',
  'Chrome/Edge/Chromium',
  Boolean(chrome),
  chrome ?? 'not found',
  'install one, or set CHROME_PATH to its executable — shoot.mjs needs it for screenshots',
)

// ---------------------------------------------------------------- required: the generator
const skillRoots = [
  resolve('.claude/skills'),
  resolve('.agents/skills'),
  join(homedir(), '.claude/skills'),
  join(homedir(), '.agents/skills'),
  join(homedir(), '.claude/plugins'),
]
const findDir = (root, wanted, depth = 3) => {
  if (depth === 0 || !existsSync(root)) return null
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return null
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const full = join(root, e.name)
    if (e.name === wanted) return full
    const deeper = findDir(full, wanted, depth - 1)
    if (deeper) return deeper
  }
  return null
}
const findFile = (root, wanted, depth = 4) => {
  if (depth === 0 || !existsSync(root)) return null
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return null
  }
  for (const e of entries) {
    const full = join(root, e.name)
    if (e.isFile() && e.name === wanted) return full
    if (e.isDirectory()) {
      const deeper = findFile(full, wanted, depth - 1)
      if (deeper) return deeper
    }
  }
  return null
}

const tasteDir = skillRoots.map((r) => findDir(r, 'taste-skill')).find(Boolean) ?? null
const tasteScripts = tasteDir ? findFile(tasteDir, 'gate.mjs') : null
add(
  'landing pages only',
  'taste-skill',
  Boolean(tasteDir),
  tasteDir
    ? `${tasteDir}${tasteScripts ? `\n             gate.mjs: ${tasteScripts}` : '\n             gate.mjs NOT FOUND — unexpected layout'}`
    : 'not installed — only needed for a marketing/landing page',
  'pnpm dlx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend" --agent claude-code --copy --rename taste-skill -y',
)

// ---------------------------------------------------------------- optional / no install
add(
  'no install needed',
  'screenshots (shoot.mjs)',
  Boolean(chrome),
  chrome ? 'node .claude/skills/design-to-figma/scripts/shoot.mjs <file>' : 'needs a Chromium browser',
  'install a Chromium-family browser, or set CHROME_PATH',
)
add(
  'no install needed',
  'impeccable detector',
  true,
  'pnpm dlx impeccable detect <file> --json   (exit 0 = clean)',
  'nothing to install; do NOT run `pnpm dlx impeccable install`',
)

const getPlaywrightRoot = () => {
  if (WIN) return join(process.env.LOCALAPPDATA ?? '', 'ms-playwright')
  if (MAC) return join(homedir(), 'Library/Caches/ms-playwright')
  return join(homedir(), '.cache/ms-playwright')
}
const pwRoot = getPlaywrightRoot()
const pw = existsSync(pwRoot)
add(
  'optional',
  'designlang browser',
  pw,
  pw ? pwRoot : 'Playwright browsers not found',
  'pnpm dlx designlang install-browser  (falls back to an installed Chrome without it)',
)

// ---------------------------------------------------------------- project state
const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

const cfg = readJson(resolve('design/tokens.config.json'))
let tokensEntry = cfg?.entry ? resolve(cfg.entry) : null
let tokensPkg = null
if (!tokensEntry && existsSync(resolve('packages'))) {
  for (const d of readdirSync(resolve('packages'), { withFileTypes: true })) {
    if (!d.isDirectory()) continue
    const pkg = readJson(resolve('packages', d.name, 'package.json'))
    if (pkg?.name?.endsWith('tokens') || d.name.endsWith('tokens')) {
      tokensPkg = d.name
      tokensEntry = resolve('packages', d.name, 'dist/index.js')
      break
    }
  }
}
const tokensBuilt = tokensEntry ? existsSync(tokensEntry) : false
add(
  'project',
  'tokens package',
  Boolean(tokensEntry),
  tokensEntry ? `${relative(process.cwd(), tokensEntry)}${tokensBuilt ? ' (built)' : ' — NOT BUILT'}` : 'not found',
  tokensEntry ? 'pnpm --filter <tokens package> build' : 'pnpm turbo gen package-tokens — phase 1 can do this',
)

add(
  'project',
  'design/tokens.config.json',
  Boolean(cfg),
  cfg ? `entry: ${cfg.entry ?? '(default)'}` : 'absent — generator falls back to the template shape',
  `write it once; mandatory if your tokens package is not packages/tokens${tokensPkg && tokensPkg !== 'tokens' ? ` (yours is packages/${tokensPkg})` : ''}`,
)

const design = existsSync(resolve('design/DESIGN.md'))
add(
  'project',
  'design/DESIGN.md',
  design,
  design ? 'direction settled — phase 1 conforms to it' : 'absent — phase 1 will deal a direction',
  null,
)

// ---------------------------------------------------------------- output
if (json) {
  const required = checks.filter((c) => c.group === 'required' && !c.ok)
  console.log(JSON.stringify({ checks, missingRequired: required.map((c) => c.name) }, null, 2))
  process.exit(required.length > 0 ? 1 : 0)
}

const LABEL = {
  required: 'REQUIRED',
  'no install needed': 'NO INSTALL NEEDED',
  'landing pages only': 'LANDING PAGES ONLY (app screens need no generator)',
  optional: 'OPTIONAL',
  project: 'PROJECT',
}
console.log('\ndesign-to-figma preflight\n')
for (const group of ['required', 'no install needed', 'landing pages only', 'optional', 'project']) {
  const rows = checks.filter((c) => c.group === group)
  if (rows.length === 0) continue
  console.log(LABEL[group])
  for (const c of rows) {
    // Only REQUIRED can fail the run; elsewhere a false check is a note, not a problem.
    let mark = 'NOTE   '
    if (c.ok) mark = 'OK     '
    else if (group === 'required') mark = 'MISSING'
    console.log(`  ${mark}  ${c.name.padEnd(26)} ${c.detail}`)
    if (!c.ok && c.fix) console.log(`             ${group === 'required' ? 'fix' : 'note'}: ${c.fix}`)
  }
  console.log('')
}
console.log('MANUAL (cannot be detected)')
console.log('  Figma Community plugins: html2figma (HTML -> layers), Tokens Studio (tokens -> variables)')
console.log('  A Figma draft file to import into. On Starter, work in drafts, not the team folder.\n')

const missing = checks.filter((c) => c.group === 'required' && !c.ok)
if (missing.length > 0) {
  console.log(`${missing.length} required item(s) missing: ${missing.map((c) => c.name).join(', ')}`)
  console.log('Install them, then run /design again.\n')
  process.exit(1)
}
console.log('All required items present.\n')
