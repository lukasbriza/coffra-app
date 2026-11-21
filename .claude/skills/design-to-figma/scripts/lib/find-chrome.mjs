/* eslint-disable turbo/no-undeclared-env-vars --
   Standalone script helper, not a turbo task: env vars are OS lookups. */

// Locates a Chromium-family browser. Shared by preflight.mjs and shoot.mjs so the candidate
// list lives in one place. CHROME_PATH always wins.

import { existsSync } from 'node:fs'
import path from 'node:path'

const { join } = path

const WIN = process.platform === 'win32'
const MAC = process.platform === 'darwin'

const platformCandidates = () => {
  if (WIN) {
    return [
      process.env.CHROME_PATH,
      join(process.env['ProgramFiles'] ?? String.raw`C:\Program Files`, 'Google/Chrome/Application/chrome.exe'),
      join(
        process.env['ProgramFiles(x86)'] ?? String.raw`C:\Program Files (x86)`,
        'Google/Chrome/Application/chrome.exe',
      ),
      join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
      join(process.env['ProgramFiles'] ?? String.raw`C:\Program Files`, 'Microsoft/Edge/Application/msedge.exe'),
    ]
  }
  if (MAC) {
    return [
      process.env.CHROME_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ]
  }
  return [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/snap/bin/chromium',
  ]
}

export const chromeCandidates = () => platformCandidates().filter(Boolean)

export const findChrome = () => chromeCandidates().find((p) => existsSync(p)) ?? null
