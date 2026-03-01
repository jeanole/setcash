# PROJ-11: Reports & Exports

## Status: Planned
**Created:** 2026-03-01
**Last Updated:** 2026-03-01

## Dependencies
- Requires: PROJ-5 (auth)
- Requires: PROJ-6 (PostgreSQL data)
- Requires: PROJ-9 (categories & motives for grouping)

## User Stories
- As an admin, I want to view a spending report grouped by motive and category so that
  I can understand where project money went.
- As an admin, I want to export bills to a PDF so that I can submit them for reimbursement.
- As an admin, I want to export bills to an Excel file so that I can do further analysis.
- As an admin, I want to download a ZIP archive of bill images so that I have physical
  receipt backups.
- As a user, I want to filter the report by date range and motive so that I only see
  relevant data.

## Acceptance Criteria
- [ ] `/app/(protected)/reports/page.tsx` — spending report with filters: date range
      (from/to), motive (multi-select), category (multi-select), status
- [ ] Report shows: grouped rows (motive → category → bills), subtotals per group,
      grand total; amounts formatted in project currency
- [ ] "Export PDF" button → GET `/api/reports/export/pdf?[query params]` → streams a PDF
      generated with PDFKit; file named `vbudget-report-YYYY-MM-DD.pdf`
- [ ] "Export Excel" button → GET `/api/reports/export/excel?[query params]` → streams
      an XLSX file generated with ExcelJS; file named `vbudget-report-YYYY-MM-DD.xlsx`
- [ ] "Download Images ZIP" button → GET `/api/reports/export/zip?[query params]` → streams
      a ZIP of bill images for the filtered set; file named `vbudget-images-YYYY-MM-DD.zip`
- [ ] Exports respect the same filters as the report page (same query params)
- [ ] All export routes require admin role; 403 for regular users
- [ ] Loading indicator while export is being generated
- [ ] Empty state if no bills match filters: "No bills match your filters"

## Edge Cases
- Report with 1000+ bills → PDF/Excel generation must stream (not load all into memory first)
- Bill has no image → ZIP export skips it silently; PDF notes "No image attached"
- Date range with no bills → empty report rendered (not an error)
- Currency formatting: use project-level currency symbol from settings; default to `€`
- Excel: numeric amount columns must be formatted as number (not text) for correct sorting

## Technical Requirements
- PDF: PDFKit (same library as existing Express app — output must be equivalent)
- Excel: ExcelJS (same library as existing Express app)
- ZIP: `archiver` npm package
- All three export routes are Next.js Route Handlers (`app/api/.../route.ts`)
- Branch: `to_nextjs`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
