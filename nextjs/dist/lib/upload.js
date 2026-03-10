"use strict";
// ============================================================================
// File Upload Utility
// ============================================================================
// Uses formidable for multipart/form-data parsing in Next.js App Router
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPLOADS_DIR = void 0;
exports.parseForm = parseForm;
exports.getUploadedFiles = getUploadedFiles;
exports.getUploadedFile = getUploadedFile;
exports.validateFile = validateFile;
exports.ensureUploadDir = ensureUploadDir;
exports.generateFilename = generateFilename;
exports.deleteFile = deleteFile;
exports.readFileForOCR = readFileForOCR;
const formidable_1 = require("formidable");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
exports.UPLOADS_DIR = process.env.UPLOADS_DIR || path_1.default.join(process.cwd(), '..', 'data', 'uploads');
// Allowed file types
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
/**
 * Parse multipart form data from a Next.js request
 */
async function parseForm(req) {
    // Convert Web Request to Node IncomingMessage-like object
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
        throw new Error('Content-Type must be multipart/form-data');
    }
    // Create a temporary buffer to hold the request body
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // Create a mock IncomingMessage
    const mockReq = new (require('stream').Readable)();
    mockReq.push(buffer);
    mockReq.push(null);
    mockReq.headers = {
        'content-type': contentType,
        'content-length': buffer.length.toString(),
    };
    return new Promise((resolve, reject) => {
        const form = new formidable_1.IncomingForm({
            uploadDir: exports.UPLOADS_DIR,
            keepExtensions: true,
            maxFileSize: MAX_FILE_SIZE,
            maxFiles: 10,
            filter: (part) => {
                const ext = path_1.default.extname(part.originalFilename || '').toLowerCase();
                return ALLOWED_EXTENSIONS.includes(ext);
            },
        });
        form.parse(mockReq, (err, fields, files) => {
            if (err) {
                reject(err);
                return;
            }
            resolve({ fields, files });
        });
    });
}
/**
 * Get array of uploaded files from form result
 */
function getUploadedFiles(files, fieldName) {
    const fileOrFiles = files[fieldName];
    if (!fileOrFiles)
        return [];
    if (Array.isArray(fileOrFiles))
        return fileOrFiles;
    return [fileOrFiles];
}
/**
 * Get single uploaded file from form result
 */
function getUploadedFile(files, fieldName) {
    const fileOrFiles = files[fieldName];
    if (!fileOrFiles)
        return null;
    if (Array.isArray(fileOrFiles))
        return fileOrFiles[0] || null;
    return fileOrFiles;
}
/**
 * Validate file type and size
 */
function validateFile(file) {
    const ext = path_1.default.extname(file.originalFilename || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return { valid: false, error: `File type not allowed: ${ext}` };
    }
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` };
    }
    return { valid: true };
}
/**
 * Ensure upload directory exists for a user
 */
function ensureUploadDir(userEmail) {
    const userFolder = userEmail.split('@')[0];
    const userDir = path_1.default.join(exports.UPLOADS_DIR, userFolder);
    if (!fs_1.default.existsSync(exports.UPLOADS_DIR)) {
        fs_1.default.mkdirSync(exports.UPLOADS_DIR, { recursive: true });
    }
    if (!fs_1.default.existsSync(userDir)) {
        fs_1.default.mkdirSync(userDir, { recursive: true });
    }
    return userFolder;
}
/**
 * Generate unique filename for bill image
 */
function generateFilename(userFolder, billNumber, dateStr, suffix = '', originalFilename = '') {
    const ext = path_1.default.extname(originalFilename) || '.jpg';
    return `${userFolder}_${billNumber}_${dateStr}${suffix}${ext}`;
}
/**
 * Delete a file from the uploads directory
 */
function deleteFile(filePath) {
    if (!filePath)
        return;
    const fullPath = path_1.default.join(exports.UPLOADS_DIR, filePath);
    if (fs_1.default.existsSync(fullPath)) {
        try {
            fs_1.default.unlinkSync(fullPath);
        }
        catch (e) {
            console.error('Failed to delete file:', e);
        }
    }
}
/**
 * Read file for OCR processing
 */
function readFileForOCR(filePath) {
    if (!filePath)
        return null;
    const fullPath = path_1.default.join(exports.UPLOADS_DIR, filePath);
    if (!fs_1.default.existsSync(fullPath)) {
        return null;
    }
    return fs_1.default.readFileSync(fullPath);
}
