const TOC_PATTERNS = [
  /table of contents/i,
  /^contents$/i,
  /^index$/i,
  /^preface$/i,
  /^acknowledgements?$/i,
  /^bibliography$/i,
  /^references$/i,
  /^appendix/i,
  /^\s*chapter\s+\d+\s*[\.\:\-]?\s*$/i,
  /^\s*unit\s+\d+\s*[\.\:\-]?\s*$/i,
  /^\s*module\s+\d+\s*[\.\:\-]?\s*$/i,
  /^\s*part\s+[ivx\d]+\s*[\.\:\-]?\s*$/i,
];

function isLikelyTOCOrBoilerplate(text) {
  if (!text || text.trim().length < 3) return true;

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (TOC_PATTERNS.some((p) => p.test(trimmed) || p.test(lower))) return true;

  // Dotted leaders typical in TOC: "Introduction .......... 12"
  if (/\.{4,}/.test(trimmed)) return true;

  // Short line ending with page number only (TOC entry)
  if (trimmed.length < 100 && /\s+\d{1,3}\s*$/.test(trimmed) && !trimmed.includes('?')) {
    const words = trimmed.replace(/\s+\d+\s*$/, '').split(/\s+/);
    if (words.length <= 8) return true;
  }

  // Mostly chapter/section listing
  if (/^(chapter|section|unit|module|part)\s+\d+/i.test(trimmed) && trimmed.length < 120 && !trimmed.includes('?')) {
    return true;
  }

  return false;
}

function isSubstantiveContent(text) {
  if (!text || text.trim().length < 100) return false;
  if (isLikelyTOCOrBoilerplate(text)) return false;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 30) return false;

  // Skip pages that are mostly numbers (page numbers, indexes)
  const alphaRatio = (text.match(/[a-zA-Z]/g) || []).length / text.length;
  if (alphaRatio < 0.5) return false;

  return true;
}

function filterSubstantivePages(pages, { skipFirst = 1 } = {}) {
  if (!pages?.length) return [];

  return pages.filter((pg, idx) => {
    if (idx < skipFirst && pg.page <= skipFirst) return false;
    return isSubstantiveContent(pg.text);
  });
}

function filterSubstantiveChunks(chunks) {
  return chunks.filter((c) => isSubstantiveContent(c));
}

function isLowQualityQuizQuestion(question) {
  if (!question?.question) return true;

  const q = question.question.trim();
  const lower = q.toLowerCase();

  if (isLikelyTOCOrBoilerplate(q)) return true;

  const badPatterns = [
    /table of contents/i,
    /list (all )?(the )?(chapters|sections|units|modules|topics|pages)/i,
    /what (chapters|sections|units) (are|is)/i,
    /name (all )?(the )?(chapters|sections)/i,
    /which page (is|does|contains)/i,
    /what is on page \d/i,
    /how many (chapters|sections|units|pages)/i,
    /identify the (chapter|section) (titles|headings)/i,
    /outline of (the )?(book|notes|document)/i,
    /^what is (the )?(title|author|publisher)/i,
    /copyright/i,
    /isbn/i,
  ];

  if (badPatterns.some((p) => p.test(lower))) return true;

  // Question too short / meta
  if (q.length < 25) return true;

  return false;
}

function buildSubstantiveTextFromPages(pages, maxChars = 28000) {
  const substantive = filterSubstantivePages(pages, { skipFirst: 2 });
  let out = '';
  for (const pg of substantive) {
    const block = `[Page ${pg.page}]: ${pg.text}\n\n`;
    if (out.length + block.length > maxChars) break;
    out += block;
  }
  return out.trim();
}

module.exports = {
  isLikelyTOCOrBoilerplate,
  isSubstantiveContent,
  filterSubstantivePages,
  filterSubstantiveChunks,
  isLowQualityQuizQuestion,
  buildSubstantiveTextFromPages,
};
