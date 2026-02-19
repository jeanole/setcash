vBudget Specification

Living document. Update this file whenever features are added, changed, or planned.

Version: 1.6.1
Industry Context: Film Production & Media Projects
Stack: Node.js + Express + SQLite (better-sqlite3) + Vanilla HTML/JS + PDFKit + ExcelJS + Google Sheets API

1. System Overview

vBudget is a multi-tenant, web-based expense tracking and budget management system designed for film productions and media projects.

Core principles:

Strict project isolation

Context-aware UI

Deterministic financial calculations

Multi-axis budget allocation (Motive × Category)

Advance payment tracking (V-Geld)

Full audit history

Telegram ingestion (per project)

Export-ready architecture

2. Routing Architecture

vBudget has exactly two application entry points:

Route	Purpose
/	Main project application (single integrated interface)
/superadmin	Global system administration

There is no separate /admin page.
Project administration is integrated into the main app as a role-gated tab.

3. UI Architecture
3.1 Context-Aware Header

Every project has:

title

subtitle

Displayed permanently in the header.

Switching projects updates:

Visible title/subtitle

All queries scoped to project_id

Sidebar context

3.2 Main App (/) — Single Integrated Interface

The main app behaves like a one-page application.

Tabs

Upload (default landing)

Bills

Spending

V-Geld

Budget

Reports

Admin (visible only to Project Admins)

All operate within the active project_id.

4. Roles & Access Control
4.1 Global Role

Stored in users.super_admin (boolean).

If true:

Access to /superadmin

Full system control

4.2 Project Roles

Stored in project_members.role.

Allowed values:

'user'
'admin'

Project User

Upload bills

View spending

View own V-Geld

Edit own draft bills

Project Admin

All user permissions

Manage members

Manage positions

Manage motives

Manage categories

Manage budget matrix

Manage V-Geld transfers

Delete bills

Access Admin tab

There is no Owner role.

5. Database Schema
Core Tables
Table	Purpose
users	Global accounts + super_admin flag
projects	Project containers (title, subtitle, telegram_bot_token)
project_members	User ↔ project with role + position
project_positions	Project-specific positions
project_settings	Per-project configuration
motives	First allocation axis (with budget)
categories	Second allocation axis (with budget)
budget_matrix	Budget per motive × category
bills	Expense records
bill_motives	Bill → motive percentage
bill_categories	Bill → category percentage
bill_images	Multiple images per bill
vgeld	Advance transfers
editlog	Audit trail
telegram_links	Telegram user mapping
telegram_link_codes	Short-lived link codes
settings	Global fallback settings

There is no global roles table.

Bills — Key Columns
id
date
email
bill_number
status ('complete' | 'draft')
type ('Kauf' | 'Leih' | 'Verbrauch')
vendor
item
comment
telegram_caption
brutto19
brutto7
brutto0
netto_amount
project_id

Protected Defaults

The following cannot be renamed or deleted:

Motive: "Default"

Category: "Uncategorized"

Position: "Misc"

Default motive automatically receives remainder allocation to reach 100%.

6. Financial Engine
6.1 Tax System

Three VAT tiers:

19%

7%

0%

User enters only gross values:

Netto = Brutto / (1 + rate)


System computes:

Netto per tier

Total Netto

Total Brutto

Draft bills are excluded from calculations.

6.2 Multi-Allocation Logic

Bills can be split across:

Multiple motives

Multiple categories

Stored in junction tables.

Allocation formula:

allocated_netto = bill_netto × percentage / 100


Rules:

Motive total must equal 100%

Category total must equal 100%

Default / Uncategorized auto-fill remainder if needed

7. Main App Tabs
7.1 Upload (Default Landing)

Features:

Multi-image upload (max 10)

Mobile camera capture

Bill type: Kauf / Leih / Verbrauch

Vendor

Item

Comment

Bill number (auto or custom)

Motive allocation widget

Category allocation widget

Telegram drafts appear here for completion.

7.2 Bills

Features:

Pagination (20 per page)

Sortable columns

Filters:

Person

Motive

Category

Position

Type

Date range

Text search

Inline image gallery

Carousel + fullscreen viewer

Edit modal (all fields + allocations)

Add/delete images

Bulk delete (admin only)

Edit history sidebar

Draft badge (red "Entwurf")

Warm-tinted draft rows

Draft bills:

Excluded from spending & budget

Promoted to complete when any brutto > 0

7.3 Spending

Netto-based budget monitoring.

By Motive

Budget

Spent

Remaining

% used

By Category

Same metrics.

Color coding:

Red → Over budget

Orange → >80%

Green → OK

Grand totals displayed.

7.4 V-Geld

Advance tracking per user.

Formula:

Current Balance = Total Advance - Total Expenses


Features:

Transfer history table

Per-user breakdown

Admin can add/delete transfers

Draft bills excluded.

7.5 Budget

Interactive matrix:

Columns: Motives

Rows: Categories

Editable cells

Spending overlay

Save all

PDF export (landscape)

7.6 Reports

User-based PDF generation.

Includes:

V-Geld summary

Bills table

Individual bill pages with images

Final balance

7.7 Admin (Role-Gated Tab)

Visible only to Project Admins.

Sections:

Members

Add/edit/remove

Role assignment

Position management

Settings

Project title

Subtitle

Google Sheets

Enable/disable sync

Sheet IDs

Service account upload

Status indicator

Export

Excel export (Bills / V-Geld / Budget Matrix)

ZIP image download

Push to Google Sheet

Telegram

Bot token

Enable toggle

Bot status

Linked accounts

Unlink function

8. Super-Admin (/superadmin)

Only accessible if:

users.super_admin = true


Capabilities:

Global project CRUD

Global user CRUD

Per-project member management

Per-project position management

System oversight

Operates outside project context.

9. Telegram Integration

Each project may configure one bot.

Flow:

Admin adds bot token

User links account via 6-char code

User sends photo(s)

Bot groups album (1.5s buffer)

Draft bill created

Caption stored raw

Confirmation sent

Draft lifecycle:

Status = 'draft'

Excluded from calculations

Promoted on brutto entry

Future-ready for LLM extraction.

10. Exports
PDF

User Bill Report

Budget Matrix Report

Excel

Sheets:

Bills (with allocations)

V-Geld

Budget Matrix

Google Sheets

Push bills

Pull bills

Configurable per project

11. Security

bcrypt hashing

8+ character password rule

Session-based auth (24h TTL)

Rate limit: 5 login attempts / 15 min

Role-based middleware

Escaped user content

Security headers

/data path blocked

12. Multi-Tenant Principles

All queries scoped by project_id

Strict project isolation

No cross-project data leakage

Super-admin bypass only at global level
