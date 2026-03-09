# vBudget — Project Index

**Next Available IDs:** PROJ-20 · BUG-43 · CR-11

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
| [PROJ-8](PROJ-8-budget-matrix.md) | Feature | Budget Matrix | Complete | — | PROJ-5, PROJ-6 | 2026-03-01 |
| [PROJ-9](PROJ-9-categories-motives.md) | Feature | Categories & Motives Admin Pages | Complete | — | PROJ-5, PROJ-6 | 2026-03-01 |
| [PROJ-10](PROJ-10-members-projects-settings.md) | Feature | Members, Projects & Settings | Complete | — | PROJ-5, PROJ-6 | 2026-03-01 |
| [PROJ-11](PROJ-11-reports-exports.md) | Feature | Reports & Exports | Complete | — | PROJ-5, PROJ-6, PROJ-9 | 2026-03-01 |
| [PROJ-12](PROJ-12-integrations.md) | Feature | Integrations (Google Sheets + Telegram) | In Progress | — | PROJ-5, PROJ-10 | 2026-03-04 |
| [PROJ-13](PROJ-13-production-cutover.md) | Feature | Production Cutover | Planned | — | PROJ-4–12 | 2026-03-01 |
| [CR-6](CR-6-camera-upload-bills.md) | CR | Add Camera Capture to Bill Upload | Deployed | High | PROJ-7 | 2026-03-04 |
| [CR-7](CR-7-image-crop-overlay.md) | CR | Add Image Crop Feature with Overlay Buttons | Deployed | Medium | PROJ-7 | 2026-03-04 |
| [BUG-9](BUG-9-duplicate-image-upload-sections.md) | Bug | Duplicate Image Upload Sections on New Bill Page | Resolved | High | PROJ-7 | 2026-03-04 |
| [BUG-10](BUG-10-hardcoded-isadmin-exposes-admin-ui.md) | Bug | Hardcoded isAdmin Flag Exposes Admin UI to All Users | Resolved | Critical | PROJ-7 | 2026-03-04 |
| [BUG-11](BUG-11-missing-rate-limiting.md) | Bug | Missing Rate Limiting on Bill Creation and Re-analysis | Resolved | Medium | PROJ-7 | 2026-03-04 |
| [PROJ-14](PROJ-14-spending-overview.md) | Feature | Spending Overview | In Progress | — | PROJ-7, PROJ-9 | 2026-03-04 |
| [PROJ-15](PROJ-15-vgeld-advance-money.md) | Feature | V-Geld (Advance Money) | In Review | — | PROJ-7 | 2026-03-04 |
| [PROJ-16](PROJ-16-notifications-system.md) | Feature | Notifications System | In Progress | — | PROJ-5, PROJ-10 | 2026-03-04 |
| [PROJ-17](PROJ-17-super-admin.md) | Feature | Super-Admin | Change Requested | — | PROJ-5, PROJ-10 | 2026-03-04 |
| [CR-8](CR-8-create-user-button-super-admin.md) | CR | Add Create User Button to Super Admin Users Tab | Pending Review | Medium | PROJ-17 | 2026-03-04 |
| [BUG-12](BUG-12-docker-test-container-build-fails.md) | Bug | Docker Test Container Build Fails with TypeScript Errors | Resolved | High | PROJ-4 | 2026-03-05 |
| [BUG-13](BUG-13-project-switching-not-updating-session.md) | Bug | Project Switching Does Not Update Session | Resolved | Critical | PROJ-10 | 2026-03-05 |
| [BUG-14](BUG-14-mobile-menu-not-working.md) | Bug | Mobile Navigation Menu Not Working | Resolved | Critical | PROJ-4 | 2026-03-06 |
| [BUG-15](BUG-15-budget-matrix-sql-column-error.md) | Bug | Budget Matrix SQL Query Uses Wrong Column Names | Resolved | Critical | PROJ-8 | 2026-03-06 |
| [BUG-16](BUG-16-budget-prisma-enum-error.md) | Bug | Budget Page Crashes with Prisma Enum Error | Resolved | Critical | PROJ-8 | 2026-03-06 |
| [BUG-17](BUG-17-budget-unsaved-changes-indicator.md) | Bug | Missing Visual Indicator for Unsaved Cell Changes | Resolved | Medium | PROJ-8 | 2026-03-06 |
| [BUG-18](BUG-18-budget-skeleton-loader.md) | Bug | Missing Skeleton Loader During Data Fetch | Resolved | Low | PROJ-8 | 2026-03-06 |
| [BUG-19](BUG-19-budget-motive-deletion-handling.md) | Bug | No Graceful Handling if Motive Deleted Mid-Session | Resolved | Low | PROJ-8 | 2026-03-06 |
| [BUG-20](BUG-20-budget-large-number-overflow.md) | Bug | Very Large Numbers Overflow Cell Layout | Resolved | Medium | PROJ-8 | 2026-03-06 |
| [BUG-21](BUG-21-budget-network-retry.md) | Bug | Network Failure Shows Error But No Retry Button | Resolved | Low | PROJ-8 | 2026-03-06 |
| [BUG-22](BUG-22-budget-session-timeout.md) | Bug | Session Timeout During Edit Not Handled Gracefully | Resolved | Medium | PROJ-8 | 2026-03-06 |
| [BUG-23](BUG-23-budget-floating-point-precision.md) | Bug | Potential Floating Point Precision Issues | Resolved | Low | PROJ-8 | 2026-03-06 |
| [BUG-24](BUG-24-superadmin-jwt-project-switch.md) | Bug | Superadmin JWT Not Updating on Project Switch | Resolved | Critical | PROJ-10 | 2026-03-06 |
| [BUG-25](BUG-25-members-get-missing-admin-auth.md) | Bug | GET Members API Missing Admin-Only Authorization | Resolved | Medium | PROJ-10 | 2026-03-06 |
| [PROJ-18](PROJ-18-atelier-ui-cinematic-effects.md) | Feature | Atelier UI + Cinematic Effects | In Progress | — | PROJ-4, PROJ-7 | 2026-03-07 |
| [BUG-26](BUG-26-budget-billstatus-enum-draft.md) | Bug | Budget Page Crashes with Invalid BillStatus Enum Value "draft" | Resolved | Critical | PROJ-8 | 2026-03-07 |
| [BUG-27](BUG-27-project-switcher-broken.md) | Bug | Project Switcher Broken — Selected Project Not Reflected in Title or Menubar | Resolved | Critical | — | 2026-03-07 |
| CR-9 | CR | Budget Matrix Express Parity — Inline Motives/Categories, Cell UX, Visuals | Pending Review | High | PROJ-8 | 2026-03-07 |
| [BUG-28](BUG-28-motive-category-allocation-refuses-selection.md) | Bug | Motive/Category Allocation Widget Refuses Selection on New Bill | Resolved | High | PROJ-7 | 2026-03-07 |
| [BUG-29](BUG-29-new-bill-not-saved-or-not-shown.md) | Bug | New Bill Not Saved or Not Appearing in Bills Table | Resolved | High | PROJ-7 | 2026-03-07 |
| [BUG-30](BUG-30-vgeld-balance-400-no-project.md) | Bug | V-Geld Balance Sidebar Widget Returns 400 When No Project Selected | Resolved | Medium | PROJ-15 | 2026-03-07 |
| [PROJ-19](PROJ-19-ocr-ai-bill-analysis-nextjs.md) | Feature | OCR / AI Bill Analysis (Next.js) | In Review | — | PROJ-7, PROJ-10 | 2026-03-08 |
| [BUG-31](BUG-31-images-not-visible-after-upload.md) | Bug | Images Not Visible After Upload in New Bill Form | Resolved | High | PROJ-7 | 2026-03-08 |
| [BUG-32](BUG-32-view-bill-detail-error.md) | Bug | Clicking View on Bills Table Produces Error | Resolved | High | PROJ-7 | 2026-03-08 |
| [BUG-33](BUG-33-upload-not-working-after-crop-modal.md) | Bug | Upload Not Working After Crop Modal | Resolved | Critical | PROJ-7 | 2026-03-08 |
| [BUG-34](BUG-34-view-bill-error-in-table.md) | Bug | Clicking View in Bills Table Not Working | Resolved | Critical | PROJ-7 | 2026-03-08 |
| [CR-10](CR-10-no-upload-button-new-bill.md) | CR | Remove Separate Upload Button from New Bill Form | Deployed | Medium | PROJ-7 | 2026-03-08 |
| [BUG-35](BUG-35-add-more-images-upload-fails.md) | Bug | Add More Images Upload Fails on Bill Detail Page | Resolved | Critical | PROJ-7 | 2026-03-08 |
| [BUG-36](BUG-36-image-preview-too-small.md) | Bug | Uploaded Image Previews Displayed Too Small | Resolved | Medium | PROJ-7 | 2026-03-08 |
| [BUG-37](BUG-37-project-selection-no-effect.md) | Bug | Project Selection Has No Effect | Resolved | Critical | — | 2026-03-08 |
| [BUG-38](BUG-38-images-not-shown-bill-not-editable.md) | Bug | Images Not Shown in Bill Detail View / Bill Not Editable | Resolved | High | PROJ-7 | 2026-03-08 |
| [BUG-39](BUG-39-upload-eacces-permission-denied-data-uploads.md) | Bug | Upload Fails with EACCES Permission Denied on /data/uploads | Resolved | Critical | PROJ-7 | 2026-03-08 |
| [BUG-40](BUG-40-ocr-date-prisma-datetime-error.md) | Bug | OCR Job Crashes with Prisma DateTime Error When Date Extracted | Resolved | High | PROJ-19 | 2026-03-09 |
| [BUG-41](BUG-41-pdf-export-helvetica-afm-not-found.md) | Bug | User PDF Export Fails with ENOENT — Helvetica.afm Not Found in Docker | Resolved | High | PROJ-11 | 2026-03-09 |
| [BUG-42](BUG-42-pdf-export-helvetica-afm-regression.md) | Bug | PDF Export Fails — Helvetica.afm ENOENT Regression | Resolved | High | PROJ-11 | 2026-03-09 |
