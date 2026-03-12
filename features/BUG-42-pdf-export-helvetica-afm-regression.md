# BUG-42: PDF Export Fails — Helvetica.afm ENOENT Regression

**Status:** Resolved
**Reported:** 2026-03-09
**Severity:** High
**Skill Tag:** [Backend]
**Feature:** PROJ-11: Reports & Exports

---

## Description

### Expected Behavior
Clicking the PDF export on a user report downloads a PDF file successfully.

### Actual Behavior
The PDF generation crashes with `ENOENT: no such file or directory` for `/app/.next/server/chunks/data/Helvetica.afm`. The download fails and an error is returned to the browser. This is the **same error as BUG-41**, which was previously marked Resolved in commit `48c4590`.

## Steps to Reproduce

1. Run the app via `docker-compose.test.yml` (local Docker)
2. Navigate to Reports → Export PDF
3. Trigger a user PDF report download
4. Observe: request fails; no PDF is downloaded

## Environment

- **Browser/Client:** Browser
- **OS:** Local Docker (`docker-compose.test.yml`)
- **Screen Size:** N/A
- **Date/Time:** 2026-03-09

## Error Message

```
Error generating user PDF: Error: ENOENT: no such file or directory, open '/app/.next/server/chunks/data/Helvetica.afm'
    at Object.readFileSync (node:fs:448:20)
    at Object.Helvetica (/app/.next/server/chunks/7496.js:75:2419)
    at new o0 (/app/.next/server/chunks/7496.js:75:3317)
    at o4.open (/app/.next/server/chunks/7496.js:96:97)
    at lU.font (/app/.next/server/chunks/7496.js:145:7143)
    at lU.initFonts (/app/.next/server/chunks/7496.js:145:6784)
    at new lU (/app/.next/server/chunks/7496.js:113:1083)
    at g (/app/.next/server/app/api/reports/user/[email]/pdf/route.js:1:3152)
    at async /app/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:38411
    at async e_.execute (/app/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:27880) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'open',
  path: '/app/.next/server/chunks/data/Helvetica.afm'
}
```

## Root Cause Analysis

BUG-41 applied two fixes:
1. `serverExternalPackages: ['pdfkit', 'fontkit']` in `nextjs/next.config.mjs` — tells Next.js not to bundle pdfkit
2. `COPY --from=builder /app/node_modules/pdfkit ./node_modules/pdfkit` in `nextjs/Dockerfile` — copies font data to standalone output

Both fixes are present in the source code. However, pdfkit is **still being bundled** (the stack trace shows it loading from `chunks/7496.js`), which means the Docker image being tested was **built before the BUG-41 fix was applied** (stale cached image) — OR the `serverExternalPackages` setting is not sufficient and pdfkit is still getting bundled.

## Root Cause (Confirmed)

`serverExternalPackages: ['pdfkit', 'fontkit']` in `next.config.mjs` is not sufficient for Next.js 14 App Router route handlers — pdfkit is still bundled into webpack chunks. Two attempts were made:

1. **Attempt 1 (BUG-41 fix):** `serverExternalPackages` + Dockerfile COPY — pdfkit still bundled → ENOENT Helvetica.afm
2. **Attempt 2:** Switch to `require('pdfkit')` — pdfkit still bundled, but webpack's ESM/CJS interop now returns a namespace object instead of the constructor → `TypeError: j is not a constructor`

**Root cause:** `serverExternalPackages` is not honored in Next.js 14.2 App Router route handlers. The package must be added explicitly to webpack's `config.externals` array.

**Fix:** Add `pdfkit` and `fontkit` to `config.externals` via the `webpack` callback in `next.config.mjs`. Restore static `import PDFDocument from 'pdfkit'` (webpack ESM interop handles CJS constructor correctly when the package is a true external).

---

## Resolution

**Status:** Resolved
**Resolved Date:** 2026-03-09
**Fixed In:** (pending commit)
**Fix Description:** Added `pdfkit` and `fontkit` to webpack `config.externals` in `next.config.mjs`. Restored static `import PDFDocument from 'pdfkit'` in both route handlers.
