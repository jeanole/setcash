# BUG-41: User PDF Export Fails with ENOENT — Helvetica.afm Not Found in Docker

**Status:** Open
**Reported:** 2026-03-09
**Severity:** High
**Skill Tag:** [Backend] [Frontend]
**Feature:** PROJ-11: Reports & Exports

---

## Description

### Expected Behavior
Clicking the PDF export on a user report downloads a PDF file.

### Actual Behavior
The PDF generation crashes with `ENOENT: no such file or directory` for `/app/.next/server/chunks/data/Helvetica.afm`. The download fails and an error is returned to the browser.

## Steps to Reproduce

1. Deploy the app to Docker
2. Navigate to a user report page
3. Click the PDF export / download button
4. Observe: request fails with 500; no PDF is downloaded

## Environment

- **Browser/Client:** Browser
- **OS:** Docker (Linux container)
- **Screen Size:** N/A
- **Date/Time:** 2026-03-09

## Additional Context

Full error from server logs:

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
```

**Root Cause:** PDFKit reads font files (`.afm`) from disk at runtime using `readFileSync`. When Next.js bundles the API route for production, it does not copy PDFKit's font data files into the output directory. The path `data/Helvetica.afm` (relative to the PDFKit package) becomes unreachable inside `.next/server/chunks/data/`.

**Known fix pattern:** Add `pdfkit` (and any other native/file-reading packages) to `serverExternalPackages` in `next.config` so Next.js does not bundle it — it is then `require()`d at runtime from `node_modules` where font files are present:

```js
// next.config.js
const nextConfig = {
  serverExternalPackages: ['pdfkit'],
};
```

Alternatively, copy font files into the build output via a `postbuild` script or Dockerfile `COPY` step.

---

## Resolution

**Status:** Open
**Resolved Date:** —
**Fixed In:** —
**Fix Description:** —
