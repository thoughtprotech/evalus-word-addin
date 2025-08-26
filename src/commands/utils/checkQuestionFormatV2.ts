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

      const html: string[] = htmlResults.map(r => r?.value || "");
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
      directionHtml: dirHtml.join("\n"),
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

    // Options: consecutive OPTION tokens
    let optStopIndex = 0;
    for (const t of afterStem) {
      if (t.kind !== TokenKind.OPTION) break;
      const opt = t as OptionToken;
      q.options.push(opt.optionText);
      q.optionsHtml.push(mergeHtml(opt.html || escapeHtml(opt.optionText), opt.images));
      q.optionImages.push([ ...(opt.images || []) ]);
      optStopIndex++;
    }
    const afterOptions = afterStem.slice(optStopIndex);

    // Answer: first ANSWER token if present
    if (afterOptions.length && afterOptions[0].kind === TokenKind.ANSWER) {
      const ans = afterOptions[0] as AnswerToken;
      q.answer = ans.letters;
      q.answerHtml = mergeHtml(ans.html || escapeHtml(ans.tail), ans.images);
      q.answerImages = [ ...(ans.images || []) ];
    }

    // Solution: look for first SOLUTION after answer
    const afterAnswer = afterOptions.slice(afterOptions[0]?.kind === TokenKind.ANSWER ? 1 : 0);
    if (afterAnswer.length && afterAnswer[0].kind === TokenKind.SOLUTION) {
      const sol = afterAnswer[0] as SolutionToken;
      q.solution = sol.solution;
      q.solutionHtml = mergeHtml(sol.html || escapeHtml(sol.solution), sol.images);
      q.solutionImages = [ ...(sol.images || []) ];
    }

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
  // If html already has <img> tags we assume they represent the images.
  if (/<img/i.test(baseHtml)) return baseHtml;
  const imgTags = images
    .filter(b64 => !!b64)
    .map(b64 => `<img src="data:image/png;base64,${b64}" />`) // assume png; Word usually returns png
    .join("");
  if (!baseHtml.trim()) return imgTags;
  return baseHtml + imgTags;
}