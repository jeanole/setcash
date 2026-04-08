const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

// Google Sheets setup
let sheets = null;

function getCredentialsPath() {
  const dataPath = path.join(__dirname, "data", "google-credentials.json");
  const rootPath = path.join(__dirname, "google-credentials.json");
  if (fs.existsSync(dataPath)) return dataPath;
  if (fs.existsSync(rootPath)) return rootPath;
  return null;
}

async function initGoogleServices() {
  console.log("=== initGoogleServices called ===");
  try {
    const credPath = getCredentialsPath();
    console.log("Credentials path:", credPath);
    if (!credPath) {
      console.log("Google credentials not found, Google services disabled");
      return false;
    }
    const auth = new google.auth.GoogleAuth({
      keyFile: credPath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    sheets = google.sheets({ version: "v4", auth });
    console.log("Google Sheets connected successfully");
    return true;
  } catch (e) {
    console.error("Google services init error:", e.message);
    return false;
  }
}

function getSheets() {
  return sheets;
}

module.exports = { getCredentialsPath, initGoogleServices, getSheets };
