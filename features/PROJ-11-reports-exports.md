# PROJ-11: Reports & Exports

## Status: Complete
**Created:** 2026-03-01
**Last Updated:** 2026-03-06

## Dependencies
- Requires: PROJ-5 (auth)
- Requires: PROJ-6 (PostgreSQL data)
- Requires: PROJ-9 (categories & motives for grouping)
- Requires: PROJ-10 (members, projects & settings for access control)

## User Stories

### PDF Reports
- As a user, I want to download my personal expense report as PDF so that I can submit it for reimbursement or keep records
- As an admin, I want to generate PDF reports for any project member so that I can review their expenses and V-Geld balance
- As an admin, I want to export the Budget Matrix as a PDF so that I can share the budget overview with stakeholders

### Data Exports
- As an admin, I want to export all project data to Excel so that I can perform custom analysis in spreadsheet software
- As an admin, I want to download all bill images as a ZIP archive so that I have physical receipt backups organized by user
- As an admin, I want to push project data to Google Sheets so that I can share live data with external collaborators

### Configuration
- As an admin, I want to configure Google Sheets integration (credentials + Sheet ID) so that exports can be automated
- As an admin, I want to see the status of Google Sheets integration so that I know if exports are ready to use

## Acceptance Criteria

### 1. Reports Page UI (`/app/(protected)/reports/page.tsx`)

#### 1.1 Page Layout
- [ ] Reports page accessible from sidebar navigation (visible to all authenticated users)
- [ ] Page has two main sections: "PDF Reports" and "Data Exports"
- [ ] Loading state shown while report options are initializing

#### 1.2 User PDF Report Section
- [ ] User selection dropdown showing all project members who have bills (admin/owner see all; regular users see only themselves)
- [ ] Dropdown displays: email + position/role name in parentheses (e.g., "john@example.com (Gaffer)")
- [ ] "Download User Report (PDF)" button triggers PDF generation
- [ ] Button disabled while loading; shows spinner during generation
- [ ] Generated PDF filename format: `{projectTitle}_report_{username}_{YYYY-MM-DD}.pdf`

#### 1.3 Budget Matrix PDF Section
- [ ] "Download Budget Matrix (PDF)" button available to all users
- [ ] Button disabled while loading; shows spinner during generation
- [ ] Generated PDF filename format: `{projectTitle}_budget_matrix_{YYYY-MM-DD}.pdf`

#### 1.4 Data Exports Section (Admin/Owner Only)
- [ ] Export buttons hidden for regular users (not disabled — hidden)
- [ ] Three export options visible to admin/owner:
  - "Export to Excel" button
  - "Download Images (ZIP)" button
  - "Push to Google Sheets" button
- [ ] Google Sheets section shows configuration status indicator

### 2. PDF User Report Generation (`GET /api/reports/user/[email]/pdf`)

#### 2.1 Access Control
- [ ] Users can only access their own reports (403 if trying to access another user's report)
- [ ] Admins, owners, and super-admins can access any project member's report
- [ ] 404 returned if user has no bills and no V-Geld in the project

#### 2.2 PDF Content — Page 1 (Summary)
- [ ] Header with project title/subtitle (from settings), centered
- [ ] User info line: `Benutzer: {email} ({position})`
- [ ] Generation date: `Erstellt: {DD.MM.YYYY}`

#### 2.3 V-Geld Section (if any V-Geld exists)
- [ ] Section title: "V-Geld Zahlungen"
- [ ] List each V-Geld payment: `{date} - {amount} EUR von {from_user}`
- [ ] If no V-Geld: display "Keine V-Geld Zahlungen vorhanden."
- [ ] Total line: `V-Geld Gesamt: {total} EUR` (bold)

#### 2.4 Bills Table
- [ ] 11 columns with headers (font size 6, bold): Nr. | Datum | Handler | Artikel | Br. 19% | Br. 7% | Br. 0% | Brutto | Nt. 19% | Nt. 7% | Netto
- [ ] Table header has underline stroke
- [ ] Each row shows:
  - `bill_number` (or sequential number)
  - Date formatted as DD.MM.YYYY
  - Vendor (truncated to 11 chars)
  - Item (truncated to 10 chars)
  - Brutto amounts for each tax rate
  - Brutto total (bold)
  - Netto calculations (brutto / 1.19, brutto / 1.07)
  - Netto total (bold)
- [ ] Automatic page breaks when table exceeds page height (rowY > 750)
- [ ] Font size 6 for table content

#### 2.5 Expense Summary Section
- [ ] Title: "Ausgaben Zusammenfassung"
- [ ] Three-column layout: Label | Brutto | Netto
- [ ] Rows:
  - Anzahl Belege: {count}
  - Gesamt 19%: {brutto} EUR | {netto} EUR
  - Gesamt 7%: {brutto} EUR | {netto} EUR
  - Gesamt 0%: {brutto} EUR | {netto} EUR
  - Separator line
  - Ausgaben Gesamt (bold): {brutto} EUR | {netto} EUR
  - V-Geld Gesamt (bold): {amount} EUR
  - Saldo (brutto) (bold, colored): {balance} EUR — green if >= 0, red if negative

#### 2.6 Individual Bill Pages (starting page 2)
- [ ] Each bill starts on a new page with page break
- [ ] Bill header: "Beleg {bill_number} - {date}" (font size 12, bold)
- [ ] Bill details:
  - `Typ: {type} | Motiv: {motive}` (with percentage allocations if split)
  - `Kategorie: {category}` (with percentage allocations if split)
  - `Handler: {vendor} | Artikel: {item}`
  - Brutto amounts breakdown by tax rate
  - Netto amounts breakdown by tax rate
  - Comment (if present): `Notiz: {comment}`
- [ ] Images displayed below details:
  - Max 400x300px, centered, fit within bounds
  - Image index shown if multiple images: "Bild 1 / 3" (gray, font size 8)
  - New page added if image would overflow (doc.y > 450)
  - Supported formats: JPG, JPEG, PNG
  - Unsupported formats: display "[Bild: {filename} - Format nicht unterstutzt]"
  - Missing files: display "[Bild nicht gefunden: {filename}]" or "[Bild konnte nicht geladen werden: {filename}]"

### 3. Budget Matrix PDF Report (`GET /api/reports/budget-matrix/pdf`)

#### 3.1 PDF Format
- [ ] Landscape A4 format (size: A4, layout: landscape)
- [ ] Margins: 40pt all sides

#### 3.2 Header
- [ ] Title: `{projectTitle} - Budget Matrix (netto)` (font size 18, bold, centered)
- [ ] Subtitle (if set): project subtitle below title (font size 10)
- [ ] Generation date: `Erstellt: {DD.MM.YYYY}` (font size 10, centered)

#### 3.3 Matrix Table
- [ ] Columns: Categories (rows) × Motives (columns) + Total Budget + Spent
- [ ] Corner cell: "Kategorie \\ Motiv" (dark background #2c3e50, white text)
- [ ] Motive headers: dark background #34495e, white text
- [ ] Row headers (categories): light gray background #f0f3f6, dark text
- [ ] Cell values: Currency formatted as "#,##0.00 €" (German format with comma decimal)
- [ ] Cell backgrounds:
  - White (#fff) for zero values
  - Very light green (#f9fff9) for positive budget values
- [ ] Spent column color coding:
  - Green (#27ae60) if spent < 80% of budget
  - Orange (#e67e22) if spent >= 80% and < 100% of budget
  - Red (#e74c3c) if spent >= 100% of budget
  - Background matches text color at 5% opacity

#### 3.4 Footer Rows
- [ ] "Budget (netto)" row: shows column totals for each motive + grand total
- [ ] "Ausgaben (netto)" row: shows actual spending per motive + grand total spent
- [ ] Both footer rows have light gray background (#ecf0f1)
- [ ] Spending percentages calculated and color-coded same as spent column

#### 3.5 Summary Section
- [ ] Title: "Zusammenfassung" (font size 11, bold)
- [ ] Lines:
  - `Total Budget (netto): {amount} €`
  - `Total Ausgaben (netto): {amount} €`
  - `Verbleibend: {amount} €` — green if >= 0, red if negative (bold)
  - `Verbraucht: {percentage}%`

### 4. Excel Export (`GET /api/admin/export/excel`)

#### 4.1 Access Control
- [ ] Admin/Owner only (403 for regular users)

#### 4.2 File Format
- [ ] XLSX format (Excel 2007+)
- [ ] Filename: `{projectName}_export_{YYYY-MM-DD}.xlsx`
- [ ] Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

#### 4.3 Worksheet 1: "Bills"
- [ ] 15 columns with headers (bold, dark background #2C3E50, white text):
  | Column | Key | Width | Format |
  |--------|-----|-------|--------|
  | ID | id | 6 | Number |
  | Nr. | bill_number | 10 | Text |
  | Date | date | 18 | Date (DD.MM.YYYY HH:MM) |
  | Email | email | 24 | Text |
  | Type | type | 10 | Text |
  | Vendor | vendor | 20 | Text |
  | Item | item | 24 | Text |
  | Comment | comment | 24 | Text |
  | Brutto 19% | brutto19 | 14 | Currency (#,##0.00 €) |
  | Brutto 7% | brutto7 | 14 | Currency (#,##0.00 €) |
  | Brutto 0% | brutto0 | 14 | Currency (#,##0.00 €) |
  | Brutto Total | brutto_total | 14 | Currency (#,##0.00 €) |
  | Netto | netto | 14 | Currency (#,##0.00 €) |
  | Motives | motives | 30 | Text |
  | Categories | categories | 30 | Text |
- [ ] Motives column: Shows allocation with percentages (e.g., "Production (70%), Post-Production (30%)")
- [ ] Categories column: Shows allocation with percentages
- [ ] Rows sorted by bill ID (oldest first)

#### 4.4 Worksheet 2: "V-Geld"
- [ ] 6 columns with headers (bold, dark background #2C3E50, white text):
  | Column | Key | Width | Format |
  |--------|-----|-------|--------|
  | ID | id | 6 | Number |
  | Date | date | 18 | Date (DD.MM.YYYY HH:MM) |
  | Amount | amount | 14 | Currency (#,##0.00 €) |
  | From | from_user | 24 | Text |
  | To | to_user | 24 | Text |
  | Created By | created_by | 24 | Text |
- [ ] Rows sorted by ID

#### 4.5 Worksheet 3: "Budget Matrix"
- [ ] Dynamic columns based on project motives
- [ ] Header row: "Category \\ Motive" | {motive names...} | "Total Budget" | "Spent"
- [ ] Data rows: One per category with budget values per motive intersection
- [ ] Total row: "Total" | {motive budget totals...} | {grand total} | {grand spent}
- [ ] Spent row: "Spent" | {motive spending...} | {grand spent} | (empty)
- [ ] Header row styled: bold, dark background #2C3E50, white text
- [ ] Total row styled: bold, light gray background #ECF0F1
- [ ] Spent row styled: bold
- [ ] All numeric columns formatted as currency

### 5. ZIP Image Export (`GET /api/admin/export/images`)

#### 5.1 Access Control
- [ ] Admin/Owner only (403 for regular users)

#### 5.2 File Format
- [ ] ZIP format with deflate compression (level 5)
- [ ] Filename: `{projectName}_images_{YYYY-MM-DD}.zip`
- [ ] Content-Type: `application/zip`

#### 5.3 Folder Structure
- [ ] Images organized in folders by username (email prefix)
- [ ] Each folder name: `{username}` (sanitized: alphanumeric, underscore, hyphen only)

#### 5.4 File Naming Convention
- [ ] Pattern: `{username}_{billNumber}_{date}_{vendor}(_{index}){extension}`
- [ ] Components:
  - `username`: Email prefix, sanitized
  - `billNumber`: bill_number field or bill ID
  - `date`: YYMMDD format (e.g., "250304" for March 4, 2025)
  - `vendor`: Sanitized (alphanumeric, space→hyphen, special chars removed)
  - `index`: Two-digit number (01, 02...) if bill has multiple images
  - `extension`: Original file extension (.jpg, .png, etc.)
- [ ] Example: `john_001_250304_Amazon_01.jpg`

#### 5.5 Error Handling
- [ ] 404 if no images exist in project
- [ ] Skip missing files silently (don't include in ZIP)

### 6. Google Sheets Integration

#### 6.1 Configuration UI (in Settings > Export tab)
- [ ] Service account credentials upload:
  - File input accepting JSON files
  - Upload button saves credentials to `{DATA_DIR}/google-credentials.json`
  - Validation: must be valid JSON with required Google service account fields
- [ ] Export Sheet ID input:
  - Text field for Google Sheet ID (from Sheet URL)
  - Save button stores in project_settings table
- [ ] Status indicator showing:
  - Green: Credentials + Sheet ID configured
  - Yellow: Credentials only (no Sheet ID)
  - Red: Not configured
- [ ] "Test Connection" button to verify credentials work

#### 6.2 Push to Google Sheets (`POST /api/admin/export/google-sheet`)
- [ ] Admin/Owner only (403 for regular users)
- [ ] Returns 400 if Google services not configured (no credentials)
- [ ] Returns 400 if no Export Sheet ID configured
- [ ] Creates/updates three tabs: "Bills", "V-Geld", "Budget Matrix"
- [ ] Removes any default/extra tabs (e.g., "Sheet1")
- [ ] Clears existing data before writing
- [ ] Data format matches Excel export structure
- [ ] Applies formatting:
  - Header row: Dark background (#2C3E50), white bold text
  - Freeze first row
- [ ] Response includes sheetUrl: `https://docs.google.com/spreadsheets/d/{sheetId}/edit`
- [ ] Shows success message with link to open sheet

### 7. API Route Structure (Next.js Route Handlers)

| Route | Method | Access | Description |
|-------|--------|--------|-------------|
| `/api/reports/users` | GET | All users | List users with bills for dropdown |
| `/api/reports/user/[email]/pdf` | GET | Self + Admin | Generate user PDF report |
| `/api/reports/budget-matrix/pdf` | GET | All users | Generate budget matrix PDF |
| `/api/admin/export/excel` | GET | Admin/Owner | Download Excel export |
| `/api/admin/export/images` | GET | Admin/Owner | Download ZIP of images |
| `/api/admin/export/google-sheet` | POST | Admin/Owner | Push to Google Sheets |
| `/api/admin/export/google-config` | GET/POST | Admin/Owner | Get/update Google config |

## Edge Cases

### Data Edge Cases
- [ ] **Empty project (no bills)**: Excel export creates file with headers only; ZIP returns 404; PDF user report returns 404
- [ ] **User with bills but no images**: PDF generates normally, image section skipped; ZIP excludes this user
- [ ] **Bill with no images**: PDF shows bill details but no image section; ZIP skips
- [ ] **Bill with legacy single image (bills.file)**: PDF falls back to legacy column; ZIP uses bill_images table only
- [ ] **Bill with 10+ images**: PDF displays all images across multiple pages as needed
- [ ] **Very long vendor/item names**: Truncated in PDF table (11/10 chars), full text in individual bill page
- [ ] **Special characters in project name**: Sanitized in filenames (replace non-alphanumeric with underscore)

### Export Edge Cases
- [ ] **Large dataset (1000+ bills)**: Excel uses streaming; PDF uses pagination; ZIP processes sequentially
- [ ] **Concurrent exports**: Each export request is independent, no locking required
- [ ] **Export interrupted (client disconnect)**: Server stops processing when response closed
- [ ] **Google Sheets API quota exceeded**: Return 429 with message about quota limits
- [ ] **Google Sheet not shared with service account**: Return 403 with helpful error message
- [ ] **Invalid Google credentials JSON**: Return 400 with validation error details

### Access Edge Cases
- [ ] **Deleted user still has bills**: Included in exports with original email
- [ ] **User removed from project but bills remain**: Bills still included in exports (data retention)
- [ ] **Project has no categories/motives**: Budget Matrix PDF shows empty table with headers
- [ ] **Draft bills**: Excluded from all spending calculations in exports (same as Express behavior)

### UI Edge Cases
- [ ] **Slow network during export**: Show progress indicator; allow cancellation
- [ ] **Browser blocks popup/download**: Show inline notification with retry button
- [ ] **Mobile device export**: PDF/Excel downloads work; ZIP may be large (warn if >50MB)
- [ ] **Session expires during export**: Return 401, redirect to login

## Technical Requirements

### Libraries
- **PDF Generation**: PDFKit (same as Express app — output must be visually equivalent)
- **Excel Generation**: ExcelJS (same as Express app)
- **ZIP Creation**: `archiver` npm package
- **Google Sheets**: `googleapis` with service account authentication

### Performance
- [ ] PDF generation: Stream to response, don't buffer entire document in memory
- [ ] Excel export: Use streaming for large datasets (>1000 rows)
- [ ] ZIP export: Stream archive directly to response
- [ ] Image processing: Read files asynchronously, don't load all into memory

### Security
- [ ] All export routes verify session and project access
- [ ] Admin-only routes check `currentProjectRole` is 'admin' or 'owner' (or superAdmin)
- [ ] User PDF route checks email parameter matches session user OR user is admin
- [ ] File paths sanitized to prevent directory traversal
- [ ] Google credentials file stored outside web root (`data/google-credentials.json`)

### Browser Compatibility
- [ ] PDF downloads work in Chrome, Firefox, Safari, Edge
- [ ] Excel downloads trigger native download dialog
- [ ] ZIP downloads work on mobile browsers (with size warnings)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview

PROJ-11 ports the **existing Reports & Exports feature** from Express to Next.js. The existing implementation provides PDF reports, Excel exports, ZIP image archives, and Google Sheets integration. This design ensures visual and functional parity while adopting Next.js App Router patterns.

**Existing Code to Port:**
- Backend: `routes/reporting.js` (816 lines) - PDF user reports, Budget Matrix PDF
- Backend: `routes/exports.js` (790 lines) - Excel, ZIP, Google Sheets exports
- Backend: `google.js` (42 lines) - Google API authentication helper

### Existing API to Port

| Express Route | Next.js Route | Purpose |
|---------------|---------------|---------|
| `GET /api/report/:email` | `app/api/reports/user/[email]/pdf/route.ts` | Generate user PDF report |
| `GET /api/report-users` | `app/api/reports/users/route.ts` | List users with bills for dropdown |
| `GET /api/budget-report` | `app/api/reports/budget-matrix/pdf/route.ts` | Generate Budget Matrix PDF |
| `GET /api/admin/export/excel` | `app/api/admin/export/excel/route.ts` | Download Excel export |
| `GET /api/admin/export/images` | `app/api/admin/export/images/route.ts` | Download ZIP of images |
| `POST /api/admin/export/google-sheet` | `app/api/admin/export/google-sheet/route.ts` | Push to Google Sheets |
| `GET/POST /api/admin/export/google-config` | `app/api/admin/export/google-config/route.ts` | Get/update Google config |

### Component Structure

```
Reports Page (/reports)
├── Page Header
│   ├── Title "Reports & Exports"
│   └── Subtitle description
├── Loading State
│   └── Spinner while initializing
├── PDF Reports Section
│   ├── Section Title "PDF Reports"
│   ├── User Report Card
│   │   ├── User Selector Dropdown
│   │   │   ├── Options: email + position (e.g., "john@example.com (Gaffer)")
│   │   │   └── Admin sees all users; regular users see only self
│   │   └── "Download User Report (PDF)" Button
│   │       ├── Disabled state during generation
│   │       └── Loading spinner while generating
│   └── Budget Matrix Card
│       └── "Download Budget Matrix (PDF)" Button
│           ├── Disabled state during generation
│           └── Loading spinner while generating
├── Data Exports Section (Admin/Owner Only - hidden for regular users)
│   ├── Section Title "Data Exports"
│   ├── Export Buttons Row
│   │   ├── "Export to Excel" Button
│   │   ├── "Download Images (ZIP)" Button
│   │   └── "Push to Google Sheets" Button
│   └── Google Sheets Configuration Card
│       ├── Status Indicator (Green/Yellow/Red badge)
│       ├── Service Account Upload (JSON file input)
│       ├── Sheet ID Input Field
│       ├── "Save Configuration" Button
│       └── "Test Connection" Button
└── Download Progress Indicators
    ├── Toast notifications for success/error
    └── Inline loading states on buttons
```

### Data Model

**Bills Data for Reports:**
- Core expense data with brutto/netto amounts split by tax rate (19%, 7%, 0%)
- Bill allocations: motives and categories with percentage splits
- Associated images stored in file system with metadata in database
- Status tracking (draft/confirmed) — only confirmed bills included in spending calculations

**V-Geld Transaction Data:**
- Advance money payments per user
- Tracks who received, from whom, amount, and date
- Used to calculate user balance (V-Geld received minus expenses)

**Budget Matrix Data:**
- Intersection table: categories × motives with budget amounts
- Actual spending calculated from confirmed bills with allocation percentages
- Color-coded status based on spending vs budget ratio

**Google Credentials Storage:**
- Service account JSON file stored in `data/google-credentials.json` (outside web root)
- Sheet ID stored in `project_settings` database table
- No secrets exposed to client — server-side only

### Tech Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **PDF Generation** | Server-side with PDFKit | Existing Express code uses PDFKit with precise layout control (tables, page breaks, image positioning). Port logic as-is for visual parity. Streaming output to response prevents memory issues with large reports. |
| **Excel Generation** | Server-side with ExcelJS | Existing implementation uses ExcelJS with formatting (colors, currency, dates). Same library ensures identical output format. |
| **ZIP Creation** | Server-side streaming with `archiver` | Stream archive directly to HTTP response — no temp files, constant memory usage. Organizes images in folders by username. |
| **Google Sheets** | Server-to-server with service account | Existing pattern: service account JSON + `googleapis` library. Credentials stored server-side only. |
| **File Downloads** | Direct browser download via `Content-Disposition: attachment` | Standard pattern used in Express app. Browser handles save dialog automatically. No client-side blob handling needed. |
| **Progress Indicators** | Loading states on buttons + toast notifications | Simple and reliable — no WebSocket or Server-Sent Events needed for one-shot exports. |

### Code Reuse Opportunities

**PDFKit Patterns (from `routes/reporting.js`):**
- Table layout with fixed column positions and font size 6
- Page break logic when `rowY > 750`
- Image embedding with `fit: [400, 300]` bounds
- Color coding (green/red) for positive/negative balances
- German date formatting with `toLocaleDateString('de-DE')`

**ExcelJS Patterns (from `routes/exports.js`):**
- Worksheet creation with column definitions
- Header styling: dark background (#2C3E50), white bold text
- Currency formatting: `#,##0.00 €`
- Date formatting: `DD.MM.YYYY HH:MM`

**Google Sheets Integration (from `google.js` + `routes/exports.js`):**
- `getCredentialsPath()` helper to locate service account JSON
- `google.auth.GoogleAuth` with `keyFile` authentication
- Batch update pattern for formatting headers
- Sheet structure: Bills, V-Geld, Budget Matrix tabs

**Image Processing Logic:**
- File path construction: `path.join(UPLOADS_DIR, relPath)`
- Supported formats: JPG, JPEG, PNG (validated via extension)
- Error handling for missing/unsupported images

### Dependencies

**New packages to install:**
- `pdfkit` - PDF generation library (server-side)
- `exceljs` - Excel workbook generation
- `archiver` - ZIP archive creation with streaming
- `googleapis` - Google Sheets API client

**Already installed (from PROJ-7):**
- `@prisma/client` - Database access
- `next-auth` - Authentication/session management
- `zod` - Input validation

### Security Considerations

- All export routes require authentication via NextAuth session
- Admin-only routes check `session.user.role` for 'admin', 'owner', or 'superadmin'
- User PDF route validates email parameter matches session user OR user is admin
- File path traversal prevented — uploads served through `/api/uploads/[[...path]]` with project access check
- Google credentials file stored outside web root in `data/` directory

### Performance Considerations

- **PDF streaming:** Pipe PDFKit document directly to response stream — no buffering
- **Excel streaming:** Use `workbook.xlsx.write(res)` for large datasets
- **ZIP streaming:** Pipe archiver output directly to response
- **Image handling:** Read files asynchronously, process sequentially in ZIP creation

## Open Bug Reports

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| [BUG-41](BUG-41-pdf-export-helvetica-afm-not-found.md) | High | User PDF Export Fails with ENOENT — Helvetica.afm Not Found in Docker | Resolved |
| [BUG-42](BUG-42-pdf-export-helvetica-afm-regression.md) | High | PDF Export Fails — Helvetica.afm ENOENT Regression | Open |

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
