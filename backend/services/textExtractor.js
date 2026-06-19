const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const PPT = require('ppt-to-text');

async function extractFromPdf(filePath) {
  const { text } = await extractFromPdfWithPages(filePath);
  return text;
}

async function extractFromPdfWithPages(filePath) {
  const pdfParse = require('pdf-parse');
  const buffer = fs.readFileSync(filePath);
  const pages = [];

  const pagerender = (pageData) => {
    const renderOptions = { normalizeWhitespace: false, disableCombineTextItems: false };
    return pageData.getTextContent(renderOptions).then((textContent) => {
      let lastY;
      let text = '';
      for (const item of textContent.items) {
        if (lastY === item.transform[5] || lastY === undefined) {
          text += item.str;
        } else {
          text += `\n${item.str}`;
        }
        lastY = item.transform[5];
      }
      pages.push({ page: pages.length + 1, text: text.replace(/\s+/g, ' ').trim() });
      return text;
    });
  };

  const data = await pdfParse(buffer, { pagerender });
  const fullText = pages.map((p) => p.text).join(' ');
  return {
    text: normalizeText(fullText),
    pages,
    totalPages: data.numpages || pages.length,
  };
}

function extractFromText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function extractFromTextWithPages(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return chunkTextIntoPages(raw);
}

async function extractFromDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || '';
}

async function extractFromPptx(filePath) {
  const { text } = await extractFromPptxWithPages(filePath);
  return text;
}

async function extractFromPptxWithPages(filePath) {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/i)[1], 10);
      const nb = parseInt(b.match(/slide(\d+)/i)[1], 10);
      return na - nb;
    });

  const pages = [];
  for (const name of slideNames) {
    const xml = await zip.files[name].async('text');
    const slideNum = parseInt(name.match(/slide(\d+)/i)[1], 10);
    const parts = [];
    const re = /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
    let match;
    while ((match = re.exec(xml)) !== null) {
      parts.push(match[1]);
    }
    const slideText = normalizeText(parts.join(' '));
    if (slideText) {
      pages.push({ page: slideNum, text: slideText });
    }
  }

  const fullText = pages.map((p) => p.text).join(' ');
  return {
    text: normalizeText(fullText),
    pages,
    totalPages: pages.length,
  };
}

function extractFromPpt(filePath) {
  const { text } = extractFromPptWithPages(filePath);
  return text;
}

function extractFromPptWithPages(filePath) {
  const pres = PPT.readFile(filePath);
  const slides = PPT.utils.to_text(pres) || [];
  const pages = slides
    .map((slideText, index) => ({
      page: index + 1,
      text: normalizeText(slideText || ''),
    }))
    .filter((slide) => slide.text.length > 0);

  const fullText = pages.map((slide) => slide.text).join(' ');
  return {
    text: normalizeText(fullText),
    pages,
    totalPages: pages.length,
  };
}

function chunkTextIntoPages(raw) {
  const CHARS_PER_PAGE = 3000;
  const pages = [];
  for (let i = 0; i < raw.length; i += CHARS_PER_PAGE) {
    pages.push({
      page: pages.length + 1,
      text: normalizeText(raw.slice(i, i + CHARS_PER_PAGE)),
    });
  }
  if (pages.length === 0) pages.push({ page: 1, text: '' });
  return { text: normalizeText(raw), pages, totalPages: pages.length };
}

async function extractPlainTextByExt(filePath, ext) {
  if (ext === '.pdf') return extractFromPdf(filePath);
  if (['.txt', '.md'].includes(ext)) return extractFromText(filePath);
  if (ext === '.docx') return extractFromDocx(filePath);
  if (ext === '.pptx') return extractFromPptx(filePath);
  if (ext === '.ppt') return extractFromPpt(filePath);
  return '';
}

async function extractTextWithPagesByExt(filePath, ext) {
  if (ext === '.pdf') return extractFromPdfWithPages(filePath);
  if (['.txt', '.md'].includes(ext)) return extractFromTextWithPages(filePath);
  if (ext === '.docx') {
    const raw = await extractFromDocx(filePath);
    return chunkTextIntoPages(raw);
  }
  if (ext === '.pptx') return extractFromPptxWithPages(filePath);
  if (ext === '.ppt') return extractFromPptWithPages(filePath);
  return { text: '', pages: [], totalPages: 0 };
}

async function extractText(filePath) {
  if (!fs.existsSync(filePath)) return '';

  const ext = path.extname(filePath).toLowerCase();
  return extractPlainTextByExt(filePath, ext);
}

async function extractTextWithPages(filePath) {
  if (!fs.existsSync(filePath)) return { text: '', pages: [], totalPages: 0 };

  const ext = path.extname(filePath).toLowerCase();
  return extractTextWithPagesByExt(filePath, ext);
}

function normalizeText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitIntoChunks(text, maxLen = 400) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length > maxLen && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

module.exports = { extractText, extractTextWithPages, normalizeText, splitIntoChunks };
