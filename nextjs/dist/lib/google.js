"use strict";
// ============================================================================
// Google API Utility
// ============================================================================
// Port of google.js — provides Sheets API client and credentials management
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCredentialsPath = getCredentialsPath;
exports.getSheets = getSheets;
exports.saveCredentials = saveCredentials;
exports.validateCredentialsJson = validateCredentialsJson;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const googleapis_1 = require("googleapis");
const DATA_DIR = path_1.default.join(process.cwd(), '..', 'data');
function getCredentialsPath() {
    const dataPath = path_1.default.join(DATA_DIR, 'google-credentials.json');
    if (fs_1.default.existsSync(dataPath))
        return dataPath;
    return null;
}
async function getSheets() {
    const credPath = getCredentialsPath();
    if (!credPath)
        return null;
    const auth = new googleapis_1.google.auth.GoogleAuth({
        keyFile: credPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return googleapis_1.google.sheets({ version: 'v4', auth });
}
function saveCredentials(jsonContent) {
    const credPath = path_1.default.join(DATA_DIR, 'google-credentials.json');
    fs_1.default.writeFileSync(credPath, jsonContent, 'utf-8');
}
function validateCredentialsJson(jsonContent) {
    try {
        const parsed = JSON.parse(jsonContent);
        const required = ['type', 'project_id', 'private_key', 'client_email'];
        for (const field of required) {
            if (!parsed[field]) {
                return { valid: false, error: `Missing required field: ${field}` };
            }
        }
        if (parsed.type !== 'service_account') {
            return { valid: false, error: 'Credentials must be a service account key' };
        }
        return { valid: true };
    }
    catch (_a) {
        return { valid: false, error: 'Invalid JSON' };
    }
}
