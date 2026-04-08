*On the one hand this is a project adressing a real world issue on the other hand this is a testpiece to get to know Agentic Coding. It started small and took a few turns. I tested different Agentic Skill sets to find out how to create bigger projects. First inspired by Alex Sprogis and later GSD - GetShitDone. This project also included some minor work with pencil.ai for layout and desing. Keen to go further. If you are intersted in using this project: text me! 
The project can be visited and tested at setcash.jeanlo.space*

# SetCash

Your receipts deserve better than a shoebox.

Expense tracker and budget planner for small film productions. Snap a receipt, upload it, track the budget — without the spreadsheet chaos.

## Features

- **Bill uploads** — Snap a photo, upload via web or Telegram. Done.
- **Budget matrix** — See who spent what, broken down by department and category.
- **AI bill analysis** — Automatic extraction of bill data from uploaded images.
- **Exports** — PDF, Excel, and Google Sheets sync for your accountant.
- **Telegram bot** — Send a receipt photo to the bot. Click and forget.
- **Multi-tenant** — Isolated projects with role-based access (user, admin, superadmin).
- **Admin approval** — Bills go through an approval workflow before they hit the books.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** NextAuth.js (email/password)
- **Frontend:** React + Tailwind CSS
- **Integrations:** Google Sheets API, Google Drive API, Telegram Bot API
- **AI:** OCR and bill analysis
- **Exports:** PDFKit (PDF), ExcelJS (Excel)

## Getting Started

```bash
cd nextjs
npm install
npm run dev
```

The app runs on `http://localhost:3000`.

### Environment Variables

Copy `nextjs/.env.local.example` to `nextjs/.env.local` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Secret for session signing |
| `NEXTAUTH_URL` | App URL (e.g. `http://localhost:3000`) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) |
| `OCR_ENCRYPTION_SECRET` | Secret for encrypting OCR API keys |
| `TARGET_SHEET_ID` | Google Sheets spreadsheet ID (optional) |
| `GOOGLE_DRIVE_FOLDER_ID` | Google Drive folder ID (optional) |

### Docker

```bash
cd nextjs
docker build -t setcash .
docker run -p 3000:3000 setcash
```

## Project Structure

All application code lives in `nextjs/`. See [CLAUDE.md](CLAUDE.md) for the full architecture guide.

## License

Not open source. Personal project by [Jens Möller](https://github.com/jeanole).
