/**
 * Ultra–simplified version:
 * 1. Read all paragraphs once (text + html).
 * 2. Tokenize each paragraph into a small enum (DIRECTION_START, DIRECTION_END, QUESTION, OPTION, ANSWER, SOLUTION, BLANK, OTHER).
 * 3. Validate by walking the token list (cheap, readable).
 * 4. If no errors, parse the same token list into question objects.
 * 5. Highlight paragraphs (red = invalid, green = good).
 * 6. Store JSON.
 *
 * Notes:
 * - Direction stays “active” until a direction end marker or a new direction start.
 * - Each question captures the direction text/html present at the moment its header token is seen.
 * - Options: one per paragraph only (simplifies). If you need multi-option per paragraph again you can extend tokenizeOption().
 * - Images/equations preserved via original paragraph HTML (we store paragraph HTML, not reconstructed pieces).
 */

export interface PatternConfig {
  questionPattern?: string;  // capture number in group 1, remainder in group 2
  optionPattern?: string;    // capture option label (a/b/...) in group 1
  answerPattern?: string;    // capture tail (answers list) in group 1
  solutionPattern?: string;  // capture solution text in group 1
}

// ------------------ Public Entry ------------------
export default async function checkFormatHelper(patterns?: PatternConfig): Promise<{ success: boolean; message?: string }> {
  try {
    initPatterns(patterns); // set (or keep) global regex
    return await Word.run(async context => {
        
      const paras = context.document.body.paragraphs;
      paras.load("items");
      await context.sync();

      // Load inline pictures for each paragraph
      paras.items.forEach(p => p.inlinePictures.load("items"));
      await context.sync();

      // Issue base64 image requests
      // Collect base64 image client results (type loosely any to avoid needing specific Office typings here)
      const imageResultMatrix = paras.items.map(p => {
        return p.inlinePictures.items.map(pic => pic.getBase64ImageSrc());
      });

      // Collect plain + html (request html after pictures so we only sync once more)
      const plain: string[] = paras.items.map(p => p.text || "");
      const htmlResults = paras.items.map(p => p.getRange().getHtml());

      await context.sync();

  // Normalize each paragraph's HTML: keep only <body> inner content (if present) and wrap in a single <div>.
  const html: string[] = htmlResults.map(r => normalizeBodyHtml(r?.value || ""));
        const images: string[][] = imageResultMatrix.map(row => row.map((r: any) => r.value || ""));

      if (plain.every(l => !l.trim())) {
        return { success: false, message: "Document is empty." };
      }

  // Phase 1: tokenize (now passes html + images so tokens carry original assets)
  const tokens = tokenize(plain, html, images);

      // Phase 2: validate
      const invalidIdx = validateTokens(tokens);

      // Highlight
      paras.items.forEach((p, i) => {
        if (!plain[i].trim()) {
          p.font.color = "black";
        } else if (invalidIdx.has(i)) {
            p.font.color = "red";
        } else {
            p.font.color = "green";
        }
      });
      await context.sync();

      if (invalidIdx.size > 0) {
        return { success: false, message: "Document contains formatting errors. Fix red lines." };
      }

      // Phase 3: parse questions
  const questions = parseQuestions(tokens, plain);

      await OfficeRuntime.storage.setItem("lastExtractedJson", JSON.stringify(questions));
      return { success: true };
    });
  } catch (e: any) {
    console.error(e);
    return { success: false, message: e?.message || "Unknown error." };
  }
}

// ------------------ Regex (legacy configurable) ------------------
// The following rich regexes were originally used directly inside tokenize().
// We keep them commented (or unused) for reference and potential future fall-back.
// Matching is now driven by the simpler ordered PATTERN_MAP list below.
// let Q_RE     : RegExp = /^\s*(?:Q(?:uestion)?\s*[:.\-]?\s*)?(\d+)\s*[).:.\-]?\s*(.*)$/i;
// let OPT_RE   : RegExp = /^\s*\(?([a-z])\)?[).]\s+(.*)$/i; // (a) a) a. A)
// let ANS_RE   : RegExp = /^(?:A(?:d)?ns(?:wer)?|Correct\s*Answer)\s*[):.\-]+\s*(.*)$/i;
// let SOL_RE   : RegExp = /^(?:Sol(?:ution)?|Explanation)\s*[):.\-]+\s*(.*)$/i;
let DIR_START: RegExp = /^\s*D-\d+\)\s*(.*)$/i; // numeric direction start (still used for richer capture of first line)
let DIR_END  : RegExp = /^\s*##End\s+Essay\s*$/i;

function safeRegex(raw: string, def: RegExp, flagsFallback = "i"): RegExp {
  if (!raw) return def;

  try {
    const m = raw.match(/^\/(.*)\/([gimuy]*)$/);
    if (m) {
      return new RegExp(m[1], m[2] || flagsFallback);
    }

    return new RegExp(raw, flagsFallback);
  } catch {
    return def;
  }
}

// Ordered simple prefix-like patterns. First match wins.
interface PatternEntry {
  name: string;
  type: 'QUESTION' | 'OPTION' | 'ANSWER' | 'SOLUTION' | 'DIRECTION_START';
  re: RegExp;
}
const PATTERN_MAP: PatternEntry[] = [ 
  // Direction letter variant BEFORE question patterns
  { name: 'D-Letter)', type: 'DIRECTION_START', re: /^D-[A-Z]\)/ },

  // Question markers
  { name: 'number)', type: 'QUESTION', re: /^\d+\)/ },
  { name: 'Q)',      type: 'QUESTION', re: /^Q\)/ },
  { name: 'q)',      type: 'QUESTION', re: /^q\)/ },
  { name: 'I)',      type: 'QUESTION', re: /^I\)/ },

  // Answer keywords
  { name: 'Ans)',    type: 'ANSWER', re: /^Ans\)/ },
  { name: 'ans)',    type: 'ANSWER', re: /^ans\)/ },
  { name: 'Ans.',    type: 'ANSWER', re: /^Ans\./ },
  { name: 'ans.',    type: 'ANSWER', re: /^ans\./ },

  // Solution keywords
  { name: 'Sol)',    type: 'SOLUTION', re: /^Sol\)/ },
  { name: 'Soln)',   type: 'SOLUTION', re: /^Soln\)/ },
  { name: 'Sol.',    type: 'SOLUTION', re: /^Sol\./ },
  { name: 'Soln.',   type: 'SOLUTION', re: /^Soln\./ },

  // Options (single letters) – after question markers to avoid misclassifying
  { name: 'A)', type: 'OPTION', re: /^A\)/ },
  { name: 'a)', type: 'OPTION', re: /^a\)/ },
  { name: 'B)', type: 'OPTION', re: /^B\)/ },
  { name: 'b)', type: 'OPTION', re: /^b\)/ },
  { name: 'C)', type: 'OPTION', re: /^C\)/ },
  { name: 'c)', type: 'OPTION', re: /^c\)/ },
  { name: 'D)', type: 'OPTION', re: /^D\)/ },
  { name: 'd)', type: 'OPTION', re: /^d\)/ },
  { name: 'E)', type: 'OPTION', re: /^E\)/ },
  { name: 'e)', type: 'OPTION', re: /^e\)/ }

];

function initPatterns(p?: PatternConfig) {
  // Pattern overrides deprecated in simplified PATTERN_MAP approach.
  // To re-enable custom patterns, push new entries into PATTERN_MAP here.
  if (!p) return;
}

// ------------------ Token Model ------------------
enum TokenKind {
  BLANK = "BLANK",
  DIRECTION_START = "DIRECTION_START",
  DIRECTION_END = "DIRECTION_END",
  QUESTION = "QUESTION",
  OPTION = "OPTION",
  ANSWER = "ANSWER",
  SOLUTION = "SOLUTION",
  OTHER = "OTHER"
}

interface BaseToken {
  kind: TokenKind;
  lineIndex: number;
  text: string;       // plain text of paragraph
  html: string;       // original paragraph HTML (may exclude images)
  images: string[];   // base64 images found in this paragraph
}

interface QuestionToken extends BaseToken {
  kind: TokenKind.QUESTION;
  number: number;
  stemFirstLine: string; // remainder part on same line as number
}

interface OptionToken extends BaseToken {
  kind: TokenKind.OPTION;
  label: string;
  optionText: string;
}

interface AnswerToken extends BaseToken {
  kind: TokenKind.ANSWER;
  letters: string[];
  tail: string;
}

interface SolutionToken extends BaseToken {
  kind: TokenKind.SOLUTION;
  solution: string;
}

interface DirectionStartToken extends BaseToken {
  kind: TokenKind.DIRECTION_START;
  first: string;
}

type Token =
  | BaseToken
  | QuestionToken
  | OptionToken
  | AnswerToken
  | SolutionToken
  | DirectionStartToken;

// ------------------ Tokenizer ------------------
function tokenize(lines: string[], html: string[], images: string[][]): Token[] {
  let seqQuestionCounter = 0; // fallback sequence for unnumbered question markers

  return lines.map((raw, i): Token => {
    const text = raw.trim();
    const paraHtml = html[i] || "";
    const paraImages = images[i] || [];

    const hasMeaningfulHtml = /<img|<picture|<table|<svg|<o:|<span|<div/i.test(paraHtml);

    // Treat image/formatting-only paragraphs (empty text but with HTML) as OTHER so they are not discarded.
    if (!text && !hasMeaningfulHtml && paraImages.length === 0) {
      return { kind: TokenKind.BLANK, lineIndex: i, text: raw, html: paraHtml, images: paraImages };
    }

    // Numeric direction start with captured first part
    const dNum = DIR_START.exec(text);
    if (dNum) {
  return { kind: TokenKind.DIRECTION_START, lineIndex: i, text: raw, html: paraHtml, images: paraImages, first: (dNum[1] || '').trim() };
    }

    if (DIR_END.test(text)) {
  return { kind: TokenKind.DIRECTION_END, lineIndex: i, text: raw, html: paraHtml, images: paraImages };
    }

    for (const entry of PATTERN_MAP) {
      const m = entry.re.exec(text);
      if (!m) continue;

      const remainder = text.slice(m[0].length).trim();

      switch (entry.type) {
        case 'DIRECTION_START': {
          return { kind: TokenKind.DIRECTION_START, lineIndex: i, text: raw, html: paraHtml, images: paraImages, first: remainder } as DirectionStartToken;
        }
        case 'QUESTION': {
          const digits = m[0].match(/^(\d+)/);
          const number = digits ? parseInt(digits[1], 10) : ++seqQuestionCounter;
          if (!digits) seqQuestionCounter = number;
      return { kind: TokenKind.QUESTION, lineIndex: i, text: raw, html: paraHtml, images: paraImages, number, stemFirstLine: remainder } as QuestionToken;
        }
        case 'OPTION': {
      return { kind: TokenKind.OPTION, lineIndex: i, text: raw, html: paraHtml, images: paraImages, label: m[0][0].toLowerCase(), optionText: remainder } as OptionToken;
        }
        case 'ANSWER': {
          // Clean leading separators after the marker
          const remainderClean = remainder.replace(/^[\s\)\.:;\-]+/, '');

          // Split on any non-letter separator, keep only single-letter tokens
          const rawTokens = remainderClean
            .split(/[^A-Za-z]+/)
            .filter(Boolean);

          // Keep single letters, lower-case, de-duplicate (order preserved)
          const letters = Array.from(
            new Set(
              rawTokens
                .filter(t => t.length === 1)
                .map(t => t.toLowerCase())
            )
          );

          return {
            kind: TokenKind.ANSWER,
            lineIndex: i,
            text: raw,
            html: paraHtml,
            images: paraImages,
            letters,
            tail: remainderClean
          } as AnswerToken;
        }
        case 'SOLUTION': {
      return { kind: TokenKind.SOLUTION, lineIndex: i, text: raw, html: paraHtml, images: paraImages, solution: remainder } as SolutionToken;
        }
      }
    }

    // OTHER (includes image-only paragraphs)
    return { kind: TokenKind.OTHER, lineIndex: i, text: raw, html: paraHtml, images: paraImages };
  });
}

// ------------------ Validation ------------------
function validateTokens(tokens: Token[]): Set<number> {
  const bad = new Set<number>();

  let i = 0;
  let activeDirection = false; // retained for possible future stricter rules

  while (i < tokens.length) {
    const t = tokens[i];

    if (t.kind === TokenKind.BLANK || t.kind === TokenKind.OTHER) {
      i++;
      continue;
    }

    if (t.kind === TokenKind.DIRECTION_START) {
      activeDirection = true;
      i++;
      continue;
    }

    if (t.kind === TokenKind.DIRECTION_END) {
      activeDirection = false;
      i++;
      continue;
    }

    if (t.kind === TokenKind.QUESTION) {
      // Collect stem lines (OTHER) until OPTION/ANSWER/SOLUTION/QUESTION/DIR markers
      i++;

      const options: OptionToken[] = [];

      while (i < tokens.length) {
        const tk = tokens[i];

        if (tk.kind === TokenKind.OPTION) {
          options.push(tk as OptionToken);
          i++;
          continue;
        }

        // stop when boundary
        if (
          tk.kind === TokenKind.ANSWER ||
          tk.kind === TokenKind.SOLUTION ||
          tk.kind === TokenKind.QUESTION ||
          tk.kind === TokenKind.DIRECTION_START ||
          tk.kind === TokenKind.DIRECTION_END
        ) {
          break;
        }

        // consume extras (OTHER / BLANK) between stem and options or just skip
        if (tk.kind === TokenKind.OTHER || tk.kind === TokenKind.BLANK) {
          i++;
          continue;
        }
        break;
      }

      if (options.length < 2) {
        options.forEach(o => bad.add(o.lineIndex));
        bad.add(t.lineIndex);
      }

      // answer
      if (i >= tokens.length || tokens[i].kind !== TokenKind.ANSWER) {
        bad.add(t.lineIndex);
      } else {
        const ans = tokens[i] as AnswerToken;
        if (ans.letters.length === 0) {
          bad.add(ans.lineIndex);
        }
        i++; // consume answer
      }

      // optional solution
      if (i < tokens.length && tokens[i].kind === TokenKind.SOLUTION) {
        i++;
      }

      continue;
    }

    // Lone OPTION / ANSWER / SOLUTION without a preceding question = invalid
    if (
      t.kind === TokenKind.OPTION ||
      t.kind === TokenKind.ANSWER ||
      t.kind === TokenKind.SOLUTION
    ) {
      bad.add(t.lineIndex);
    }

    i++;
  }

  // If direction never closed it's okay (optional). No strict check.
  return bad;
}

// ------------------ Parser ------------------
function parseQuestions(tokens: Token[], lines: string[]) {
  interface Q {
    questionNumber: number;
    question: string;
    questionHtml: string;
    questionImages: string[];
    direction: string;
    directionHtml: string;
    directionImages: string[];
    options: string[];
    optionsHtml: string[];
    optionImages: string[][];
    answer: string[];
    answerHtml: string;
    answerImages: string[];
    solution: string;
    solutionHtml: string;
    solutionImages: string[];
  }

  const out: Q[] = [];

  let currentDirectionText: string[] = [];
  let currentDirectionHtml: string[] = [];
  let currentDirectionImages: string[] = [];

  const startDirection = (startToken: DirectionStartToken) => {
    currentDirectionText = [];
    currentDirectionHtml = [];
    currentDirectionImages = [];
    if (startToken.first) currentDirectionText.push(startToken.first);
    currentDirectionHtml.push(mergeHtml(startToken.html || "", (startToken as any).images || []));
    currentDirectionImages.push(...((startToken as any).images || []));
  };

  const extendDirection = (t: Token) => {
    if (t.kind !== TokenKind.BLANK) {
      currentDirectionText.push(lines[t.lineIndex].trim());
      currentDirectionHtml.push(mergeHtml(t.html || "", (t as any).images || []));
      currentDirectionImages.push(...((t as any).images || []));
    }
  };

  // Preprocess direction segments by walking tokens once
  for (let idx = 0; idx < tokens.length; idx++) {
    const t = tokens[idx];
    if (t.kind === TokenKind.DIRECTION_START) {
      startDirection(t as DirectionStartToken);
      // absorb following non-boundary tokens as direction body
      for (let j = idx + 1; j < tokens.length; j++) {
        const nt = tokens[j];
        if (nt.kind === TokenKind.QUESTION || nt.kind === TokenKind.DIRECTION_START || nt.kind === TokenKind.DIRECTION_END) {
          idx = j - 1; // main loop will advance
          break;
        }
        extendDirection(nt);
        if (j === tokens.length - 1) idx = j; // end reached
      }
    } else if (t.kind === TokenKind.DIRECTION_END) {
      // clear direction
      currentDirectionText = [];
      currentDirectionHtml = [];
      currentDirectionImages = [];
    }
    // Store a snapshot of direction context on the token for later grouping
    (t as any).__dirText = [...currentDirectionText];
    (t as any).__dirHtml = [...currentDirectionHtml];
    (t as any).__dirImages = [...currentDirectionImages];
  }

  // Collect indices of question tokens
  const questionIndices: number[] = tokens
    .map((t, i) => (t.kind === TokenKind.QUESTION ? i : -1))
    .filter(i => i >= 0);

  questionIndices.forEach((qStartIdx, qOrdinal) => {
    // Find boundary (exclusive end)
    let end = tokens.length;
    for (let j = qStartIdx + 1; j < tokens.length; j++) {
      const k = tokens[j].kind;
      if (k === TokenKind.QUESTION || k === TokenKind.DIRECTION_START || k === TokenKind.DIRECTION_END) {
        end = j;
        break;
      }
    }
    const segment = tokens.slice(qStartIdx, end);
    const qToken = segment[0] as QuestionToken;

    // Build question base
    const dirText = (tokens[qStartIdx] as any).__dirText as string[];
    const dirHtml = (tokens[qStartIdx] as any).__dirHtml as string[];
    const dirImages = (tokens[qStartIdx] as any).__dirImages as string[];

  const q: Q = {
      questionNumber: qOrdinal + 1,
      question: qToken.stemFirstLine,
      questionHtml: mergeHtml(qToken.html, (qToken as any).images || []),
      questionImages: [ ...((qToken as any).images || []) ],
      direction: dirText.join(" ").trim(),
  // Join direction fragments with a single space instead of newlines to avoid \n in stored HTML
  directionHtml: dirHtml.join(" "),
      directionImages: [ ...dirImages ],
      options: [],
      optionsHtml: [],
      optionImages: [],
      answer: [],
      answerHtml: "",
      answerImages: [],
      solution: "",
      solutionHtml: "",
      solutionImages: []
    };

    // classify remaining tokens in segment (excluding first question token)
    const rest = segment.slice(1);

    // Stem continuation tokens come first until we hit OPTION/ANSWER/SOLUTION
    const stemContinuation: Token[] = [];
    for (const t of rest) {
      if (t.kind === TokenKind.OPTION || t.kind === TokenKind.ANSWER || t.kind === TokenKind.SOLUTION) break;
      if (t.kind !== TokenKind.BLANK) {
        q.question += (q.question ? " " : "") + lines[t.lineIndex].trim();
        q.questionHtml += mergeHtml(t.html || "", (t as any).images || []);
        q.questionImages.push(...((t as any).images || []));
      }
      stemContinuation.push(t);
    }

    // Remaining after stem continuation
    const afterStem = rest.slice(stemContinuation.length);

    // Options: allow multi-paragraph options. For each OPTION token, absorb following
    // OTHER / SOLUTION? (should not appear here) / image-only paragraphs until next OPTION/ANSWER/SOLUTION/boundary.
    let optIndex = 0;
    while (optIndex < afterStem.length) {
      const t = afterStem[optIndex];
      if (t.kind !== TokenKind.OPTION) break;
      const optTok = t as OptionToken;
      let optText = optTok.optionText.trim();
      let optHtml = mergeHtml(optTok.html || escapeHtml(optText), optTok.images);
      let optImgs: string[] = [ ...(optTok.images || []) ];
      optIndex++;
      // absorb continuation paragraphs
      while (optIndex < afterStem.length) {
        const cont = afterStem[optIndex];
        if (cont.kind === TokenKind.OPTION || cont.kind === TokenKind.ANSWER || cont.kind === TokenKind.SOLUTION) break;
        if (cont.kind === TokenKind.BLANK) { optIndex++; continue; }
        // treat OTHER (and any non-boundary) as continuation (e.g., image-only paragraph)
        optText += (optText ? ' ' : '') + lines[cont.lineIndex].trim();
        optHtml += mergeHtml(cont.html || '', (cont as any).images || []);
        optImgs.push(...((cont as any).images || []));
        optIndex++;
      }
      q.options.push(optText);
      q.optionsHtml.push(optHtml);
      q.optionImages.push(optImgs);
    }
    const afterOptions = afterStem.slice(optIndex);

    // Answer: first ANSWER token if present
    let answerConsumed = 0;
    if (afterOptions.length && afterOptions[0].kind === TokenKind.ANSWER) {
      const ans = afterOptions[0] as AnswerToken;
      q.answer = ans.letters;
      q.answerHtml = mergeHtml(ans.html || escapeHtml(ans.tail), ans.images);
      q.answerImages = [ ...(ans.images || []) ];
      answerConsumed = 1;
    }

    // Solution: multi-paragraph. Start at first SOLUTION after answer, then absorb
    // subsequent OTHER / SOLUTION / image-only paragraphs until boundary.
    const afterAnswer = afterOptions.slice(answerConsumed);
    if (afterAnswer.length && afterAnswer[0].kind === TokenKind.SOLUTION) {
      let solIndex = 0;
      const firstSol = afterAnswer[solIndex] as SolutionToken;
      let solText = firstSol.solution.trim();
      let solHtml = mergeHtml(firstSol.html || escapeHtml(firstSol.solution), firstSol.images);
      let solImgs: string[] = [ ...(firstSol.images || []) ];
      solIndex++;
      while (solIndex < afterAnswer.length) {
        const st = afterAnswer[solIndex];
        if (st.kind === TokenKind.QUESTION || st.kind === TokenKind.DIRECTION_START || st.kind === TokenKind.DIRECTION_END) break;
        if (st.kind === TokenKind.BLANK) { solIndex++; continue; }
        if (st.kind === TokenKind.ANSWER) break; // unexpected but break defensively
        // Allow additional SOLUTION token (rare) or OTHER as continuation
        const addText = lines[st.lineIndex].trim();
        if (addText) solText += (solText ? ' ' : '') + addText;
        solHtml += mergeHtml(st.html || '', (st as any).images || []);
        solImgs.push(...((st as any).images || []));
        solIndex++;
      }
      q.solution = solText;
      q.solutionHtml = solHtml;
      q.solutionImages = solImgs;
    }
  // Final pass: ensure any remaining Word temp image placeholders inside assembled HTML fields
  // are replaced using the images already associated with that field. This avoids needing a
  // secondary Word.run (cannot nest) and guarantees placeholders in concatenated fragments
  // are handled even if earlier mergeHtml steps missed them.
  q.questionHtml = embedLocalImagePlaceholders(q.questionHtml, q.questionImages);
  q.directionHtml = embedLocalImagePlaceholders(q.directionHtml, q.directionImages);
  q.answerHtml = embedLocalImagePlaceholders(q.answerHtml, q.answerImages);
  q.solutionHtml = embedLocalImagePlaceholders(q.solutionHtml, q.solutionImages);
  q.optionsHtml = q.optionsHtml.map((h, idx) => embedLocalImagePlaceholders(h, q.optionImages[idx] || []));
  // Normalize data URI src attribute quotes to single quotes to reduce JSON escaping when serialized.
  const normalizeQuotes = (h: string) => h ? h.replace(/src="data:image\/png;base64,([^"]+)"/gi, "src='data:image/png;base64,$1'") : h;
  q.questionHtml = normalizeQuotes(q.questionHtml);
  q.directionHtml = normalizeQuotes(q.directionHtml);
  q.answerHtml = normalizeQuotes(q.answerHtml);
  q.solutionHtml = normalizeQuotes(q.solutionHtml);
  q.optionsHtml = q.optionsHtml.map(h => normalizeQuotes(h));
  // NOTE: We intentionally do NOT perform a final global image injection here anymore.
  // Reason: Appending (previous behavior) could relocate image(s) to the end of the
  // combined questionHtml, losing their relative paragraph ordering. By merging images
  // only at the paragraph level (when each fragment is added) we retain original order
  // across paragraphs. If getHtml() omitted inline <img> tags inside a paragraph that
  // also contains text, we still append those images at the end of THAT paragraph's
  // fragment (best we can without positional offsets). Advanced positioning would
  // require OOXML parsing or placeholder insertion at authoring time.
  out.push(q);
  });

  return out;
}

// ------------------ Utils ------------------
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Merge original paragraph html with extracted base64 images (if images not already present in html).
function mergeHtml(baseHtml: string, images: string[] = []): string {
  if (!images.length) return baseHtml;
  let updated = baseHtml || "";

  // First, replace any local/temp Word image src placeholders with available base64 images in order.
  updated = embedLocalImagePlaceholders(updated, images);

  // Append any base64 images not already present (by value) to preserve availability (order per paragraph scope).
  for (const b64 of images) {
    if (!b64) continue;
    if (!updated.includes(b64)) {
      updated += `<img src="data:image/png;base64,${b64}" />`;
    }
  }
  return updated;
}

// Replace Word local/temp image references (e.g., ~WRS{GUID}_files/image001.png) with our extracted base64 images, sequentially.
export function embedLocalImagePlaceholders(html: string, images: string[]): string {
  if (!html) return html;
  const PLACEHOLDER_SRC_RE = /(<img\b[^>]*?src=")(?!data:)([^"]+)("[^>]*>)/gi;
  // We only want to replace if the src looks like a Word resource placeholder, not an http(s) link.
  const isWordTemp = (src: string) => /~WRS|_files\/image\d+\.(png|jpg|jpeg|gif)/i.test(src) && !/^https?:/i.test(src);
  let imgIndex = 0; // index into images array
  const used: string[] = [];
  const replaced = html.replace(PLACEHOLDER_SRC_RE, (full, pre, src, post) => {
    if (!isWordTemp(src)) return full; // leave untouched
    // Find next unused base64 image
    while (imgIndex < images.length && !images[imgIndex]) imgIndex++;
    if (imgIndex >= images.length) return full; // nothing left
    const b64 = images[imgIndex++];
    used.push(b64);
    return `${pre}data:image/png;base64,${b64}${post}`;
  });
  return replaced;
}

// Extract only the body inner HTML (if full document markup present) and wrap in a div.
function normalizeBodyHtml(raw: string): string {
  if (!raw) return '<div></div>';
  const cleaned = raw.replace(/\r/g, '');
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let inner = (bodyMatch ? bodyMatch[1] : cleaned).trim();
  // Remove bare newline characters to prevent "\n" escapes in JSON; preserve single spaces.
  inner = inner.replace(/\n+/g, ' ');
  return `<div>${inner}</div>`;
}

// ------------------ Public Helper: Replace Word Temp Image Sources in Arbitrary HTML ------------------
/**
 * Given an HTML snippet (e.g. copied from Word) containing temporary Word image src values like:
 *   <img src="~WRS{GUID}_files/image001.png">
 * this will attempt to retrieve all inline pictures in the current document (in reading order),
 * collect their base64 data, and sequentially substitute those placeholders with data URLs.
 *
 * Notes / Limitations:
 * - Word JavaScript API does not expose the original temp filenames, so mapping is positional.
 * - The first placeholder encountered in the provided HTML is replaced with the first available
 *   base64 image from the document, the second with the next, and so on.
 * - If there are more placeholders than extracted images, the extras are left unchanged.
 * - If the HTML already contains data:image src values, they are left intact.
 */
export async function replaceWordTempImageSrc(html: string): Promise<string> {
  if (!html || !/<img/i.test(html)) return html;
  try {
    const allImages: string[] = await Word.run(async context => {
      const pics = context.document.body.inlinePictures;
      pics.load("items");
      await context.sync();
      const results = pics.items.map(p => p.getBase64ImageSrc());
      await context.sync();
      return results.map(r => (r as any).value || "").filter(Boolean);
    });
    if (!allImages.length) return html; // nothing to substitute
    return embedLocalImagePlaceholders(html, allImages);
  } catch (e) {
    console.error("replaceWordTempImageSrc failed", e);
    return html; // fail safe: return original
  }
}