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

      // Collect plain + html
      const plain: string[] = paras.items.map(p => p.text || "");
      const htmlPromises = paras.items.map(p => p.getRange().getHtml());
      await context.sync();
      const html: string[] = htmlPromises.map(h => (h?.value || ""));

      if (plain.every(l => !l.trim())) {
        return { success: false, message: "Document is empty." };
      }

      // Phase 1: tokenize
      const tokens = tokenize(plain);

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
      const questions = parseQuestions(tokens, plain, html);

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
  text: string;
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
function tokenize(lines: string[]): Token[] {
  let seqQuestionCounter = 0; // fallback sequence for unnumbered question markers

  return lines.map((raw, i): Token => {
    const text = raw.trim();

    if (!text) {
      return { kind: TokenKind.BLANK, lineIndex: i, text: raw };
    }

    // Numeric direction start with captured first part
    const dNum = DIR_START.exec(text);
    if (dNum) {
      return { kind: TokenKind.DIRECTION_START, lineIndex: i, text: raw, first: (dNum[1] || '').trim() };
    }

    if (DIR_END.test(text)) {
      return { kind: TokenKind.DIRECTION_END, lineIndex: i, text: raw };
    }

    for (const entry of PATTERN_MAP) {
      const m = entry.re.exec(text);
      if (!m) continue;

      const remainder = text.slice(m[0].length).trim();

      switch (entry.type) {
        case 'DIRECTION_START': {
          return { kind: TokenKind.DIRECTION_START, lineIndex: i, text: raw, first: remainder } as DirectionStartToken;
        }
        case 'QUESTION': {
          const digits = m[0].match(/^(\d+)/);
          const number = digits ? parseInt(digits[1], 10) : ++seqQuestionCounter;
          if (!digits) seqQuestionCounter = number;
          return { kind: TokenKind.QUESTION, lineIndex: i, text: raw, number, stemFirstLine: remainder } as QuestionToken;
        }
        case 'OPTION': {
          return { kind: TokenKind.OPTION, lineIndex: i, text: raw, label: m[0][0].toLowerCase(), optionText: remainder } as OptionToken;
        }
        case 'ANSWER': {
          const letters = Array.from(remainder.matchAll(/[a-z]/gi)).map(x => x[0].toLowerCase());
          return { kind: TokenKind.ANSWER, lineIndex: i, text: raw, letters, tail: remainder } as AnswerToken;
        }
        case 'SOLUTION': {
          return { kind: TokenKind.SOLUTION, lineIndex: i, text: raw, solution: remainder } as SolutionToken;
        }
      }
    }

    return { kind: TokenKind.OTHER, lineIndex: i, text: raw };
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
function parseQuestions(tokens: Token[], lines: string[], html: string[]) {
  interface Q {
    questionNumber: number;
    question: string;
    questionHtml: string;
    direction: string;
    directionHtml: string;
    options: string[];
    optionsHtml: string[];
    answer: string[];
    answerHtml: string;
    solution: string;
    solutionHtml: string;
  }

  const out: Q[] = [];
  let i = 0;

  let currentDirectionTextParts: string[] = [];
  let currentDirectionHtmlParts: string[] = [];

  const flushDirectionIfEnd = (tk: Token) => {
    if (tk.kind === TokenKind.DIRECTION_END) {
      currentDirectionTextParts = [];
      currentDirectionHtmlParts = [];
    }
  };

  while (i < tokens.length) {
    const tk = tokens[i];

    if (tk.kind === TokenKind.DIRECTION_START) {
      // Start (or replace) direction
      currentDirectionTextParts = [];
      currentDirectionHtmlParts = [];

      const start = tk as DirectionStartToken;
      if (start.first) {
        currentDirectionTextParts.push(start.first);
      }
      currentDirectionHtmlParts.push(html[tk.lineIndex] || "");

      // Consume trailing lines until a boundary (question or direction end/start)
      i++;
      while (
        i < tokens.length &&
        tokens[i].kind !== TokenKind.QUESTION &&
        tokens[i].kind !== TokenKind.DIRECTION_END &&
        tokens[i].kind !== TokenKind.DIRECTION_START
      ) {
        if (tokens[i].kind !== TokenKind.BLANK) {
          currentDirectionTextParts.push(lines[tokens[i].lineIndex].trim());
          currentDirectionHtmlParts.push(html[tokens[i].lineIndex] || "");
        }
        i++;
      }
      continue;
    }

    if (tk.kind === TokenKind.DIRECTION_END) {
      flushDirectionIfEnd(tk);
      i++;
      continue;
    }

    if (tk.kind !== TokenKind.QUESTION) {
      i++;
      continue;
    }

    // Build question
    const qTok = tk as QuestionToken;
    const q: Q = {
      questionNumber: out.length + 1,
      question: qTok.stemFirstLine,
      questionHtml: html[qTok.lineIndex] || "",
      direction: currentDirectionTextParts.join(" ").trim(),
      directionHtml: currentDirectionHtmlParts.join("\n"),
      options: [],
      optionsHtml: [],
      answer: [],
      answerHtml: "",
      solution: "",
      solutionHtml: ""
    };

    i++;

    // Collect extra stem lines
    while (i < tokens.length) {
      const nx = tokens[i];
      if (
        nx.kind === TokenKind.OPTION ||
        nx.kind === TokenKind.ANSWER ||
        nx.kind === TokenKind.SOLUTION ||
        nx.kind === TokenKind.QUESTION ||
        nx.kind === TokenKind.DIRECTION_START ||
        nx.kind === TokenKind.DIRECTION_END
      ) {
        break;
      }

      if (nx.kind !== TokenKind.BLANK) {
        q.question += (q.question ? " " : "") + lines[nx.lineIndex].trim();
        q.questionHtml += html[nx.lineIndex] || "";
      }
      i++;
    }

    // Options
    while (i < tokens.length && tokens[i].kind === TokenKind.OPTION) {
      const opt = tokens[i] as OptionToken;
      q.options.push(opt.optionText);
      q.optionsHtml.push(html[opt.lineIndex] || escapeHtml(opt.optionText));
      i++;
    }

    // Answer
    if (i < tokens.length && tokens[i].kind === TokenKind.ANSWER) {
      const ans = tokens[i] as AnswerToken;
      q.answer = ans.letters;
      q.answerHtml = html[ans.lineIndex] || escapeHtml(ans.tail);
      i++;
    }

    // Solution (optional)
    if (i < tokens.length && tokens[i].kind === TokenKind.SOLUTION) {
      const sol = tokens[i] as SolutionToken;
      q.solution = sol.solution;
      q.solutionHtml = html[sol.lineIndex] || escapeHtml(sol.solution);
      i++;
    }

    // If direction ends immediately after question block, consume marker + clear
    if (i < tokens.length && tokens[i].kind === TokenKind.DIRECTION_END) {
      flushDirectionIfEnd(tokens[i]);
      i++;
    }

    out.push(q);
  }

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