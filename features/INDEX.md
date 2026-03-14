# SetCash — Project Index

**Next Available IDs:** PROJ-21 · BUG-84 · CR-24


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
| CR-4 | CR | Analyse Button + Field Verification in Upload Modal | Dismissed | Medium | PROJ-1 | 2026-02-27 |
| [BUG-4](BUG-4-production-startup-fails-ocr-encryption-secret.md) | Bug | Production Startup Fails — OCR_ENCRYPTION_SECRET Not Set | Resolved | High | PROJ-1 | 2026-02-27 |
| [BUG-5](BUG-5-project-delete-csrf-token-error.md) | Bug | Project Delete Button Fails with CSRF Token Error | Resolved | Critical | PROJ-2 | 2026-02-27 |
| CR-5 | CR | Re-Analyse Button for Already-Analysed Bills | Deployed | Medium | PROJ-1 | 2026-02-27 |
| [PROJ-3](PROJ-3-upload-shortcut-button.md) | Feature | Upload Shortcut Button in Bills Table | Deployed | — | — | 2026-02-28 |
| [BUG-6](BUG-6-reanalyse-fields-not-reset-to-unverified.md) | Bug | Re-analyse Does Not Reset Fields to Unverified State | Resolved | High | PROJ-1 | 2026-02-27 |
| [BUG-7](BUG-7-reanalyse-no-history-log-entry.md) | Bug | Re-analysis Produces No Bill History Log Entry | Resolved | Medium | PROJ-1 | 2026-02-27 |
| BUG-8 | Bug | Multer fileFilter Rejection Returns 500 HTML Instead of 400 JSON | Resolved | High | PROJ-3 | 2026-02-28 |
| [PROJ-4](PROJ-4-nextjs-scaffold.md) | Feature | Next.js App Scaffold + PostgreSQL + Docker | Deployed | — | — | 2026-03-01 |
| [PROJ-5](PROJ-5-nextauth-authentication.md) | Feature | NextAuth.js Authentication | Change Requested | — | PROJ-4 | 2026-03-03 |
| CR-11 | CR | Merge Landing Page and Login Page into One | Pending Review | Medium | PROJ-5 | 2026-03-11 |
| [CR-12](CR-12-forgot-password-reset.md) | CR | Add Forgot Password / Self-Service Password Reset | Pending Review | Medium | PROJ-5 | 2026-03-11 |
| [PROJ-6](PROJ-6-sqlite-postgres-migration.md) | Feature | SQLite → PostgreSQL Data Migration Script | Complete | — | PROJ-4 | 2026-03-01 |
| [PROJ-7](PROJ-7-bills-feature.md) | Feature | Bills Feature | In Progress | — | PROJ-5, PROJ-6 | 2026-03-01 |
| [PROJ-8](PROJ-8-budget-matrix.md) | Feature | Budget Matrix | Complete | — | PROJ-5, PROJ-6 | 2026-03-01 |
| [PROJ-9](PROJ-9-categories-motives.md) | Feature | Categories & Motives Admin Pages | Complete | — | PROJ-5, PROJ-6 | 2026-03-01 |
| [PROJ-10](PROJ-10-members-projects-settings.md) | Feature | Members, Projects & Settings | In Progress | — | PROJ-5, PROJ-6 | 2026-03-01 |
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
| [CR-8](CR-8-create-user-button-super-admin.md) | CR | Add Create User Button to Super Admin Users Tab | Deployed | Medium | PROJ-17 | 2026-03-04 |
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
| CR-9 | CR | Budget Matrix Express Parity — Inline Motives/Categories, Cell UX, Visuals | Dismissed | High | PROJ-8 | 2026-03-07 |
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
| [BUG-43](BUG-43-system-nav-visible-all-users-blank-error.md) | Bug | System Nav Item Visible to All Users and Produces Blank Error | Resolved | Critical | PROJ-17 | 2026-03-09 |
| [BUG-44](BUG-44-header-overlaps-modals-z-index.md) | Bug | Header Renders on Top of Modals Due to z-index | Resolved | High | PROJ-18 | 2026-03-09 |
| CR-13 | CR | Require Invite Token for All Signups (No Open Registration) | Pending Review | Medium | PROJ-10 | 2026-03-13 |
| [PROJ-20](PROJ-20-user-profile-edit.md) | Feature | User Profile Edit Panel | In Progress | Medium | PROJ-5 | 2026-03-13 |
| CR-14 | CR | Add User Profile Edit Panel | Pending Review | Medium | PROJ-20 | 2026-03-13 |
| CR-15 | CR | Saved Filter Presets on Bills List | Discussion Needed | Medium | PROJ-7 | 2026-03-14 |
| CR-16 | CR | User Onboarding Flow | Discussion Needed | Medium | PROJ-5 | 2026-03-14 |
| CR-17 | CR | Bill-Level Comments / Discussion Thread | Discussion Needed | Medium | PROJ-7 | 2026-03-14 |
| CR-18 | CR | Bulk Bill Status Actions | Discussion Needed | Medium | PROJ-7 | 2026-03-14 |
| CR-19 | CR | Expanded Notification Triggers | Discussion Needed | High | PROJ-16 | 2026-03-14 |
| CR-20 | CR | Dashboard Content & Widgets | Discussion Needed | High | PROJ-4 | 2026-03-14 |
| CR-21 | CR | In-App Setup Guides for Telegram & AI/OCR | Deployed | Medium | PROJ-12 | 2026-03-14 |
| [BUG-45](BUG-45-jwt-session-update-privilege-escalation.md) | Bug | JWT Session Update Trusts Client-Supplied Role — Privilege Escalation | Resolved | High | PROJ-5 | 2026-03-14 |
| [BUG-46](BUG-46-bill-image-routes-missing-ownership-check.md) | Bug | Bill Image Upload/Replace/Delete Routes Missing Owner-or-Admin Check | Resolved | High | PROJ-7 | 2026-03-14 |
| [BUG-47](BUG-47-bills-api-missing-pagination-limit.md) | Bug | GET /api/bills and /api/bills/log Have No Pagination Limit | Resolved | High | PROJ-7 | 2026-03-14 |
| [BUG-48](BUG-48-google-credentials-global-not-project-scoped.md) | Bug | Google Credentials File Is Global — Any Project Admin Overwrites All Projects | Resolved | High | PROJ-12 | 2026-03-14 |
| [BUG-49](BUG-49-telegram-encryption-silent-plaintext-fallback.md) | Bug | Telegram Token Encryption Silently Falls Back to Plaintext When Key Missing | Resolved | High | PROJ-12 | 2026-03-14 |
| [BUG-50](BUG-50-telegram-link-code-no-rate-limiting.md) | Bug | No Rate Limiting on Telegram Link Code Generation | Resolved | High | PROJ-12 | 2026-03-14 |
| [BUG-51](BUG-51-motive-category-missing-db-unique-constraint.md) | Bug | No Database Unique Constraint on Motive/Category (projectId, name) | Resolved | High | PROJ-9 | 2026-03-14 |
| [BUG-52](BUG-52-motive-category-name-not-trimmed.md) | Bug | Motive/Category Name Not Trimmed — Whitespace-Only Names Accepted | Resolved | High | PROJ-9 | 2026-03-14 |
| [BUG-53](BUG-53-project-deletion-missing-transaction.md) | Bug | Project Deletion Runs Sequential Deletes Without a Transaction | Resolved | Medium | PROJ-5 | 2026-03-14 |
| [BUG-54](BUG-54-user-deletion-missing-transaction.md) | Bug | User Deletion Not Wrapped in Transaction | Resolved | Medium | PROJ-17 | 2026-03-14 |
| [BUG-55](BUG-55-admin-user-update-bypasses-zod.md) | Bug | Admin User Update Bypasses Zod Validation on resetPassword Path | Resolved | Medium | PROJ-17 | 2026-03-14 |
| [BUG-56](BUG-56-password-change-no-rate-limiting.md) | Bug | No Rate Limiting on Password Change Endpoint | Resolved | Medium | PROJ-20 | 2026-03-14 |
| [BUG-57](BUG-57-rate-limiter-noop-without-upstash.md) | Bug | Rate Limiter Is a Silent No-Op When Upstash Redis Is Not Configured | Open | Medium | PROJ-19 | 2026-03-14 |
| CR-22 | CR | Add Qwen2.5-VL / Qwen3-VL / DeepSeek Providers + Structured System Prompt | Deployed | Medium | PROJ-19 | 2026-03-14 |
| CR-23 | CR | Enrich Telegram Upload Response with OCR Fields, Errors, and Bill Link | Deployed | Medium | PROJ-12 | 2026-03-14 |
| [BUG-58](BUG-58-ssrf-dns-rebinding-bypass.md) | Bug | SSRF Check Does Not Resolve DNS — DNS Rebinding Bypass Possible | Resolved | Medium | PROJ-19 | 2026-03-14 |
| [BUG-59](BUG-59-bill-number-race-condition.md) | Bug | Bill Number Generation Race Condition Produces Duplicates | Resolved | Medium | PROJ-7 | 2026-03-14 |
| [BUG-60](BUG-60-budget-pdf-missing-project-membership-check.md) | Bug | Budget Matrix PDF Missing Project Membership Verification | Resolved | Medium | PROJ-11 | 2026-03-14 |
| [BUG-61](BUG-61-pdf-content-disposition-header-injection.md) | Bug | User PDF Content-Disposition Filename Built from Unsanitized Email | Resolved | Medium | PROJ-11 | 2026-03-14 |
| [BUG-62](BUG-62-no-rate-limiting-on-exports.md) | Bug | No Rate Limiting on Export and Report Endpoints | Resolved | Medium | PROJ-8 | 2026-03-14 |
| [BUG-63](BUG-63-bulk-update-array-no-max-limit.md) | Bug | Budget Bulk Update Zod Array Has No Maximum Size Limit | Resolved | Medium | PROJ-8 | 2026-03-14 |
| [BUG-64](BUG-64-bulk-update-motive-category-not-validated-against-project.md) | Bug | Budget Bulk Update motiveId/categoryId Not Validated Against Current Project | Resolved | Medium | PROJ-8 | 2026-03-14 |
| [BUG-65](BUG-65-telegram-api-fetch-no-timeout.md) | Bug | Telegram API Validation Fetch Has No Timeout | Resolved | Medium | PROJ-12 | 2026-03-14 |
| [BUG-66](BUG-66-google-sheets-sync-unbounded-query.md) | Bug | Google Sheets Sync Fetches All Bills Unbounded — OOM Risk | Resolved | Medium | PROJ-12 | 2026-03-14 |
| [BUG-67](BUG-67-google-sheets-no-concurrent-sync-protection.md) | Bug | Google Sheets Sync Has No Concurrency Protection | Resolved | Medium | PROJ-12 | 2026-03-14 |
| [BUG-68](BUG-68-admin-member-self-modification-unrestricted.md) | Bug | Admin Can Self-Modify Own Project Member Record Without Restriction | Resolved | Medium | PROJ-10 | 2026-03-14 |
| [BUG-69](BUG-69-invite-route-creates-own-prisma-client.md) | Bug | Invite Route Creates Its Own PrismaClient Instead of Using Shared Singleton | Resolved | Medium | PROJ-10 | 2026-03-14 |
| [BUG-70](BUG-70-motive-cascade-delete-not-in-transaction.md) | Bug | Motive/Category Manual Cascade Delete Not Wrapped in Transaction | Resolved | Medium | PROJ-9 | 2026-03-14 |
| [BUG-71](BUG-71-reset-password-entropy-too-low.md) | Bug | Admin-Generated Reset Password Is 8 Characters, Not 12 as Specified | Resolved | Low | PROJ-5 | 2026-03-14 |
| [BUG-72](BUG-72-credentials-login-case-sensitive-email.md) | Bug | Credentials Login Uses Case-Sensitive Email Match | Resolved | Low | PROJ-5 | 2026-03-14 |
| [BUG-73](BUG-73-trust-host-disables-host-validation.md) | Bug | trustHost: true Disables Host Header Validation in NextAuth | Resolved | Low | PROJ-5 | 2026-03-14 |
| [BUG-74](BUG-74-ocr-prompt-injection-via-receipt.md) | Bug | OCR AI Response Parsed With Relaxed Regex — Prompt Injection Risk | Resolved | Low | PROJ-19 | 2026-03-14 |
| [BUG-75](BUG-75-vgeld-list-no-pagination.md) | Bug | GET /api/vgeld Has No Pagination Limit | Resolved | Low | PROJ-15 | 2026-03-14 |
| [BUG-76](BUG-76-bulk-delete-unlimited-array.md) | Bug | Bill Bulk Delete Accepts Unlimited ID Array | Resolved | Low | PROJ-7 | 2026-03-14 |
| [BUG-77](BUG-77-file-upload-extension-only-validation.md) | Bug | File Upload Validates Type by Extension Only, Not Magic Bytes | Resolved | Low | PROJ-7 | 2026-03-14 |
| [BUG-78](BUG-78-telegram-encryption-key-not-in-env-test-example.md) | Bug | TELEGRAM_ENCRYPTION_KEY Not Documented in .env.test.example | Resolved | Low | PROJ-12 | 2026-03-14 |
| [BUG-79](BUG-79-telegram-link-code-modular-bias.md) | Bug | Telegram Link Code Generation Has Slight Modular Bias | Resolved | Low | PROJ-12 | 2026-03-14 |
| [BUG-80](BUG-80-telegram-photo-download-no-extension-validation.md) | Bug | Telegram Photo Download Does Not Validate File Extension | Resolved | Low | PROJ-12 | 2026-03-14 |
| [BUG-81](BUG-81-google-sheet-error-leaks-internal-details.md) | Bug | Google Sheet Sync Error Message Leaks Internal Details to Client | Resolved | Low | PROJ-12 | 2026-03-14 |
| [BUG-82](BUG-82-categories-motives-get-returns-403-not-404.md) | Bug | Motive/Category GET Endpoints Return 403 Instead of 404 for Non-Members | Resolved | Low | PROJ-9 | 2026-03-14 |
| [BUG-83](BUG-83-invite-endpoint-no-rate-limiting.md) | Bug | No Rate Limiting on Project Invite Endpoint — Email Spam Risk | Resolved | Low | PROJ-10 | 2026-03-14 |
