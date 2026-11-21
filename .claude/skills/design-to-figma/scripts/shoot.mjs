#!/usr/bin/env node
// Screenshots a design screen at several widths, using the Chromium already on the machine.
// No npm dependency: Chrome's own --screenshot flag does the work.
//
//   node .claude/skills/design-to-figma/scripts/shoot.mjs <file.html> \
//     [--out <dir>] [--widths 1440,768,390] [--height 1200]
//
// Writes <out>/<name>-<width>.png. Default out is the screen's sibling
// ../reports/<name>/ so the report is self-contained.

/* eslint-disable no-console --
   Standalone CLI script, not a turbo task: console is its output. */

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { findChrome } from './lib/find-chrome.mjs'

const { basename, dirname, extname, resolve, join } = path

const run = promisify(execFile)

const flag = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const fail = (m) => {
  console.error(m)
  process.exit(1)
}

const input = process.argv[2]
if (!input || input.startsWith('--')) fail('Usage: shoot.mjs <file.html> [--out <dir>] [--widths 1440,768,390]')

const file = resolve(input)
if (!existsSync(file)) fail(`No such file: ${file}`)

const chrome = findChrome()
if (!chrome) fail('No Chromium-family browser found. Install one, or set CHROME_PATH.')

const name = basename(file, extname(file))
const widths = String(flag('widths', '1440,768,390'))
  .split(',')
  .map((w) => Number(w.trim()))
  .filter(Boolean)
const height = Number(flag('height', 1200))
const outDir = resolve(flag('out', join(dirname(file), '..', 'reports', name)))

if (widths.length === 0) fail('No valid widths.')

await mkdir(outDir, { recursive: true })

const written = []
for (const width of widths) {
  const out = join(outDir, `${name}-${width}.png`)
  try {
    await run(
      chrome,
      [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--hide-scrollbars',
        `--window-size=${width},${height}`,
        `--screenshot=${out}`,
        pathToFileURL(file).href,
      ],
      { timeout: 120_000 },
    )
  } catch (error) {
    fail(`Chrome failed at ${width}px: ${error.shortMessage ?? error.message}`)
  }
  if (!existsSync(out)) fail(`Chrome reported success but wrote nothing at ${width}px.`)
  written.push(out)
}

console.log(`${name}: ${written.length} screenshot(s) at ${widths.join(', ')}px`)
for (const w of written) console.log(`  ${w}`)
