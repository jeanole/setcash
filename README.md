# SetCash - Bills manager (minimal scaffold)

This project is a small app to manage bills. Users sign in with Google (when invited by an admin), upload a photo of a bill, and store bill metadata in a Google Sheet. Images are uploaded to Google Drive and the link is stored in the sheet.

Prerequisites
- Node.js (16+ recommended)
- A Google Cloud project with:
  - OAuth 2.0 Client ID (for user sign-in)
  - Service Account with access to Google Sheets and Drive APIs

Setup
1. Install dependencies:

```bash
npm install
```

2. Create or identify the Google Sheet to store data. Create three sheets inside it: `Bills`, `Invited`, and `Motives`.

   - `Invited` sheet: add invited emails in column A
   - `Motives` sheet: add allowed motives in column A
   - `Bills` sheet: columns will be appended as Date, Email, Vendor, Item, GST, Comment, Motive, DriveLink

3. Create a Google Service Account, give it Editor access to the Sheet and to the Drive folder you want to use. Download the JSON key and either:
   - Save it as `service-account.json` in the project root (not committed), or
   - Set the environment variable `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS` to the JSON content, or
   - Set `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` to the path of the JSON file.

4. Share the target Google Drive folder and the Google Sheet with the service account email.

5. Create OAuth credentials (OAuth 2.0 Client ID) and set the Authorized redirect URI to `http://localhost:3000/auth/google/callback` (adjust port if needed).

6. Set environment variables (example `.env` or export in shell):

```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
TARGET_SHEET_ID=your_sheet_id_here
DRIVE_FOLDER_ID=your_drive_folder_id_here
ADMIN_EMAIL=admin@example.com
SESSION_SECRET=a-secret
# Either GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./service-account.json or GOOGLE_SERVICE_ACCOUNT_CREDENTIALS
```

7. Run:

```bash
npm start
```

Usage
- Visit `http://localhost:3000` and sign in with Google. The user must be present in the `Invited` sheet or have the `ADMIN_EMAIL`.
- Admins can open `http://localhost:3000/admin` to invite users and add motives.

Notes
- This is a minimal working scaffold. In production you should:
  - Use HTTPS
  - Harden sessions
  - Validate and sanitize inputs
  - Add rate limiting and quotas
  - Consider storing images in a dedicated bucket
