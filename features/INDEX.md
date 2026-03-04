# vBudget — Project Index

**Next Available IDs:** PROJ-14 · BUG-12 · CR-8

| ID | Type | Title | Status | Priority | Feature | Date |
|----|------|-------|--------|----------|---------|------|
| [PROJ-1](PROJ-1-ocr-bill-analysis.md) | Feature | OCR / AI Bill Analysis | Deployed | — | — | 2026-02-24 |
| [PROJ-2](PROJ-2-security-hardening.md) | Feature | Security & Multi-tenant Hardening | Deployed | — | — | 2026-02-24 |
| [BUG-1](BUG-1-ocr-analysis-hangs-no-timeout-feedback.md) | Bug | OCR Analysis Runs Indefinitely With No UI Feedback or Timeout | Resolved | High | PROJ-1 | 2026-02-26 |
| [BUG-2](BUG-2-analyse-button-csrf-token-error.md) | Bug | Analyse Button Fails with CSRF Token Error | Resolved | High | PROJ-1 | 2026-02-27 |
| CR-1 | CR | Admin OCR/AI Logging Panel in Settings | Deployed | High | PROJ-1 | 2026-02-26 |
| CR-2 | CR | Improve Console Logging Clarity for OCR Field Writes | Deployed | Low | PROJ-1 | 2026-02-26 |
| [BUG-3](BUG-3-bill-actions-csrf-token-error.md) | Bug | Bill Actions Fail with CSRF Token Error | Resolved | High | PROJ-1 | 2026-02-27 |
| CR-3 | CR | AI Field Verification UX + Bill History/Audit Log | Deployed | High | PROJ-1 | 2026-02-27 |
| CR-4 | CR | Analyse Button + Field Verification in Upload Modal | Pending Review | Medium | PROJ-1 | 2026-02-27 |
| [BUG-4](BUG-4-production-startup-fails-ocr-encryption-secret.md) | Bug | Production Startup Fails — OCR_ENCRYPTION_SECRET Not Set | Resolved | High | PROJ-1 | 2026-02-27 |
| [BUG-5](BUG-5-project-delete-csrf-token-error.md) | Bug | Project Delete Button Fails with CSRF Token Error | Resolved | Critical | PROJ-2 | 2026-02-27 |
| CR-5 | CR | Re-Analyse Button for Already-Analysed Bills | Pending Review | Medium | PROJ-1 | 2026-02-27 |
| [PROJ-3](PROJ-3-upload-shortcut-button.md) | Feature | Upload Shortcut Button in Bills Table | Deployed | — | — | 2026-02-28 |
| [BUG-6](BUG-6-reanalyse-fields-not-reset-to-unverified.md) | Bug | Re-analyse Does Not Reset Fields to Unverified State | Resolved | High | PROJ-1 | 2026-02-27 |
| [BUG-7](BUG-7-reanalyse-no-history-log-entry.md) | Bug | Re-analysis Produces No Bill History Log Entry | Resolved | Medium | PROJ-1 | 2026-02-27 |
| BUG-8 | Bug | Multer fileFilter Rejection Returns 500 HTML Instead of 400 JSON | Resolved | High | PROJ-3 | 2026-02-28 |
| [PROJ-4](PROJ-4-nextjs-scaffold.md) | Feature | Next.js App Scaffold + PostgreSQL + Docker | Deployed | — | — | 2026-03-01 |
| [PROJ-5](PROJ-5-nextauth-authentication.md) | Feature | NextAuth.js Authentication | Complete | — | PROJ-4 | 2026-03-03 |
| [PROJ-6](PROJ-6-sqlite-postgres-migration.md) | Feature | SQLite → PostgreSQL Data Migration Script | Complete | — | PROJ-4 | 2026-03-01 |
| [PROJ-7](PROJ-7-bills-feature.md) | Feature | Bills Feature | In Progress | — | PROJ-5, PROJ-6 | 2026-03-01 |
| [PROJ-8](PROJ-8-budget-matrix.md) | Feature | Budget Matrix | Planned | — | PROJ-5, PROJ-6 | 2026-03-01 |
| [PROJ-9](PROJ-9-categories-motives.md) | Feature | Categories & Motives Admin Pages | Planned | — | PROJ-5, PROJ-6 | 2026-03-01 |
| [PROJ-10](PROJ-10-members-projects-settings.md) | Feature | Members, Projects & Settings | Planned | — | PROJ-5, PROJ-6 | 2026-03-01 |
| [PROJ-11](PROJ-11-reports-exports.md) | Feature | Reports & Exports | Planned | — | PROJ-5, PROJ-6, PROJ-9 | 2026-03-01 |
| [PROJ-12](PROJ-12-integrations.md) | Feature | Integrations (Google Sheets + Telegram) | Planned | — | PROJ-5, PROJ-10 | 2026-03-01 |
| [PROJ-13](PROJ-13-production-cutover.md) | Feature | Production Cutover | Planned | — | PROJ-4–12 | 2026-03-01 |
| [CR-6](CR-6-camera-upload-bills.md) | CR | Add Camera Capture to Bill Upload | Deployed | High | PROJ-7 | 2026-03-04 |
| [CR-7](CR-7-image-crop-overlay.md) | CR | Add Image Crop Feature with Overlay Buttons | Deployed | Medium | PROJ-7 | 2026-03-04 |
| [BUG-9](BUG-9-duplicate-image-upload-sections.md) | Bug | Duplicate Image Upload Sections on New Bill Page | Resolved | High | PROJ-7 | 2026-03-04 |
| [BUG-10](BUG-10-hardcoded-isadmin-exposes-admin-ui.md) | Bug | Hardcoded isAdmin Flag Exposes Admin UI to All Users | Resolved | Critical | PROJ-7 | 2026-03-04 |
| [BUG-11](BUG-11-missing-rate-limiting.md) | Bug | Missing Rate Limiting on Bill Creation and Re-analysis | Resolved | Medium | PROJ-7 | 2026-03-04 |
