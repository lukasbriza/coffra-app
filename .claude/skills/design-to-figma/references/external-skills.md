# External tools — what to take, what to ignore

These are **dependencies, not copies**. Do not vendor them into this repo: they version and
update on their own, and `sync-template`'s 3-way merge would fight every upstream change.
Install per project, commit nothing, keep the pins in this table honest.

The `.gitignore` already excludes the install directories.

Check what is present before the pipeline starts, rather than discovering it in phase 3:

```bash
node .claude/skills/design-to-figma/scripts/preflight.mjs
```

## Pins

| Tool | Install | Licence | Role |
|---|---|---|---|
| taste-skill (`design-taste-frontend`) | `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` | MIT | generator — phases 1–3 |
| impeccable detector | **nothing to install** — `npx impeccable detect` | Apache-2.0 | the phase 3 gate |
| designlang | `npx designlang install-browser` once | MIT | reference extraction + brand check |
| html2figma | Figma Community plugin | free, unlimited | HTML → native layers |
| Tokens Studio | Figma Community plugin | free licence | DTCG → Figma variables |

Re-run the same install command to update. Record a breaking change here when one bites.

## taste-skill — the generator

Install the single skill, not the whole collection — the repo also ships image-generation and
legacy style skills:

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"
```

In Claude Code the plugin route works too: `/plugin marketplace add Leonxlnx/taste-skill`, then
`/plugin install taste-skill@taste-skill`. The skill is namespaced under `taste-skill:`, so it
does not collide with the skills in this repo, and it lands in a `taste-skill` folder — which is
the path `.gitignore` excludes.

Preflight reports the resolved path to its `inspect.mjs`, which is what phase 3 needs — the
skill can only name it as a placeholder, because the install location varies.

Requires Node 22+, a Chrome/Edge/Chromium install or `CHROME_PATH`, and network access for its
asset fetching. On Windows, verify `CHROME_PATH` by hand before the first run. `ffmpeg` on PATH
is optional, for WebP output. The kit is large — tens of megabytes of icons and photographs —
which is another reason it is a gitignored dependency rather than vendored.

Take from it: the three-direction deal, the idea sentence, the app-screens reference (it covers
dashboards, admin views, settings and inboxes), and its inspector for the 1440/768/390 pass.

`inspect.mjs` inspects a **running page** given as a URL, or a built `index.html`; whether a bare
file path works without a server is undocumented, so phase 3 serves the screens and passes a URL.
It writes screenshots to `.taste-skill/before` and `.taste-skill/after` — copy them into the
report folder so the report is self-contained. `lint.mjs` lints source, not a rendered page.

Feed it the brief from phase 0, never style adjectives. Its own guidance asks for concrete
facts, and for app screens it wants the user role, the data fields and the screen's key
question — which is exactly what `<ui>/design/brief.md` is shaped to supply.

Budget: a full run is roughly 30–45 minutes and several hundred thousand tokens. This is the
whole reason phases 1–3 run in the `design-build` subagent.

## impeccable — detector only

Take `npx impeccable detect`: a deterministic rule set that runs in code with no LLM and no API
key. Cheap, repeatable, and it belongs in phase 3's gate.

**Do not** use its commands or its skill. It is a complete orchestrator with its own direction
dealing and its own context files, so running it alongside taste-skill means two pipelines
competing over the same decisions and paying twice for them.

**Do not run `npx impeccable install`.** Verified: the detector runs straight from npx with
nothing installed.

```bash
npx impeccable detect <file|folder|URL> [--json]
```

Tested against a deliberately bad screen; it returned `low-contrast` and `italic-serif-display`
findings with file, severity, category and snippet. `--json` gives the structured form, which is
what phase 3 parses.

**It exited 0 with two `warning` findings.** Do not use the exit code as the gate — count the
findings, or parse `--json`. A gate that trusts exit 0 passes a page with every warning in the
book.

**WCAG AA contrast is covered.** The `low-contrast` rule reports the measured ratio against the
4.5:1 body and 3:1 large-text thresholds. No separate contrast check is needed.

Skipping the install also skips what it would have written: a project install puts the skill in
`.claude/skills/impeccable/`, four subagents in `.claude/agents/` and a PostToolUse + Stop hook
in `settings.local.json`. That hook runs after each UI edit, which contradicts this repo's rule
that linting stays at commit time. And with no install there is no telemetry and no remote roll
call to opt out of.

## designlang — reference extraction and verification

Two uses, both optional but both cheap:

- `npx designlang <url>` reads a reference site in a real browser and reports its colours,
  type, spacing, radii, shadows and motion. Raw material for phase 1 — never the design itself.
  Requires Node 20+. It drives Chromium through Playwright, so run
  `npx designlang install-browser` **once** — without it the tool falls back to an installed
  Chrome, which may not be there.
- It can also write agent rules of its own, including `.claude/skills/designlang/SKILL.md`.
  Do not keep that file; it would collide with this skill's scope. `.gitignore` excludes it.
- `npx designlang verify-ui localhost:4321/<name>.html --brand design/DESIGN.md` checks a built screen
  against the recorded direction and scores how generic it reads. Part of phase 3.

`verify-ui` takes a URL, which is the other reason phase 3 serves the screens — with
`python3 -m http.server`, because `npx serve` answers `301` on a `.html` path and redirects to
the extensionless one.

It can also emit W3C DTCG tokens, which overlaps with our own export script. Prefer the script:
it reads the project's tokens package, so the code stays the source of truth rather than a scrape.

Do not install its generated `SKILL.md` — it would collide with this skill's scope.

## Deliberately excluded

| Tool | Why not |
|---|---|
| React Bits | animated decorative components; no Figma representation, and wrong for dense data screens |
| GSAP skills | runtime motion only; nothing to export. Worth adding for a scroll-driven marketing page, in phase 5 |
| transitions.dev | same — belongs in phase 5 and is the better default for app UI than GSAP |
| Figma MCP | on a Starter plan read and write tools share a 6-call monthly limit |
| html.to.design | 10 free imports, then 10 a month |
| html2design | paid subscription |

Phase 5 motion is a separate concern on purpose. A transition has no representation in a Figma
frame, so pulling it into the design pipeline adds tokens and tool calls without changing the
deliverable.

## When to reconsider paying

Figma Professional with a Full seat unlocks variable modes, published libraries, Dev Mode and
agent-driven canvas writes. Worth it only once light **and** dark are both in scope, or someone
other than you edits the Figma file.
