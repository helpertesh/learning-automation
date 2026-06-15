const multer = require('multer');
const path = require('path');
const fs = require('fs');
const storage = require('../services/storage');

const uploadsDir = path.join(__dirname, '..', 'uploads');
['notes', 'past-papers'].forEach((dir) => {
  const full = path.join(uploadsDir, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.ps1', '.vbs', '.dll', '.sh', '.jar', '.app',
]);

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return cb(new Error(`File type ${ext} is not allowed for security reasons`));
  }
  cb(null, true);
};

function diskStorage(subfolder) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(uploadsDir, subfolder)),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `${unique}${ext}`);
    },
  });
}

function createUpload(subfolder) {
  const useMemory = storage.isCloud();
  return multer({
    storage: useMemory ? multer.memoryStorage() : diskStorage(subfolder),
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 },
  });
}

module.exports = {
  uploadNotes: createUpload('notes'),
  uploadPastPapers: createUpload('past-papers'),
};
