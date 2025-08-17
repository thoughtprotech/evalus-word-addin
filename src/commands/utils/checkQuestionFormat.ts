export default async function checkFormatHelper(): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    return await Word.run(async (context) => {
      const paras = context.document.body.paragraphs;
      paras.load("items");
      await context.sync();

  const lines = paras.items.map((p) => p.text.trim());

  // Also get HTML per paragraph to preserve equations and rich content
  const htmlResults = paras.items.map((p) => p.getRange().getHtml());
  await context.sync();
  const htmlLines = htmlResults.map((r) => (r?.value ?? "").trim());
      // Check if all lines are empty
      const nonEmptyLines = lines.filter((line) => line.length > 0);
      if (nonEmptyLines.length === 0) {
        return {
          success: false,
          message: "Document is empty.",
        };
      }

      const invalidSet = new Set(findInvalidParagraphs(lines));

      paras.items.forEach((p) => (p.font.color = "black"));

      paras.items.forEach((p, idx) => {
        if (invalidSet.has(idx)) {
          p.font.color = "red";
        } else if (p.text.trim()) {
          p.font.color = "green";
        }
      });

      await context.sync();

      if (invalidSet.size === 0) {
        const questions = extractQuestions(lines, htmlLines);
        await OfficeRuntime.storage.setItem("lastExtractedJson", JSON.stringify(questions));
        return { success: true };
      } else {
        return {
          success: false,
          message: "Document contains formatting errors. Please rectify",
        };
      }
    });
  } catch (err: any) {
    console.error("Error during checkFormat:", err.message);
    return { success: false, message: err.message || "Unknown error." };
  }
}

function findInvalidParagraphs(lines: string[]): number[] {
  const invalid: number[] = [];
  if (lines.length === 0) return [0];

  let i = 0;
  let expectedQ = 1;

  while (i < lines.length) {
    const text = lines[i];
    if (!text.trim()) {
      i++;
      continue;
    }

    // Skip direction blocks from validation perspective
    if (isDirectionStart(text)) {
      i++;
      while (i < lines.length && !isDirectionEnd(lines[i]) && !matchQuestionStart(lines[i])) {
        i++;
      }
      // consume end marker if present
      if (i < lines.length && isDirectionEnd(lines[i])) i++;
      continue;
    }
    if (isDirectionEnd(text)) {
      i++;
      continue;
    }

  const qMatch = matchQuestionStart(text);
    if (!qMatch) {
      // Not a question start; skip and mark as invalid only if it looks like a malformed question header
      if (/^\s*\d+/.test(text)) invalid.push(i);
      i++;
      continue;
    }

    // Found question start
    i++;

    // Accumulate question text lines until options/answer/solution or next question header
    while (
      i < lines.length &&
      !containsAnyOption(lines[i]) &&
      !isAnswerLine(lines[i]).matched &&
      !isSolutionLine(lines[i]).matched &&
  !matchQuestionStart(lines[i])
    ) {
      i++;
    }

    // 2) Options: can be inline or multiple per paragraph
    const collectedOptions: string[] = [];
    const optionStartIndex = i;
    while (
      i < lines.length &&
      !isAnswerLine(lines[i]).matched &&
      !isSolutionLine(lines[i]).matched &&
  !matchQuestionStart(lines[i])
    ) {
      const para = lines[i];
      const opts = splitOptionsFromParagraph(para);
      if (opts.length > 0) {
        collectedOptions.push(...opts.map((o) => o.text));
      }
      i++;
    }

    // Require at least 2 options to be lenient (many have 4)
    if (collectedOptions.length < 2) {
      invalid.push(Math.min(optionStartIndex, lines.length - 1));
    }

    // 3) Answer line (flexible)
    if (i >= lines.length || !isAnswerLine(lines[i]).matched) {
      invalid.push(Math.min(i, lines.length - 1));
    } else {
      const ans = isAnswerLine(lines[i]);
      const answers = ans.letters;
      if (answers.length === 0) {
        invalid.push(i);
      } else {
        // Ensure answers map to available options (a->index0, etc.) if options exist
        answers.forEach((a) => {
          const idx = a.charCodeAt(0) - 97;
          if (idx < 0 || idx >= Math.max(collectedOptions.length, 1)) {
            invalid.push(i);
          }
        });
      }
      i++;
    }

    // 4) Optional solution line
    if (i < lines.length && isSolutionLine(lines[i]).matched) {
      i++;
    }

    expectedQ++;
  }

  return invalid;
}

function extractQuestions(lines: string[], htmlLines: string[]) {
  const questions: any[] = [];
  let i = 0;
  let qNum = 1;
  let inDirection = false;
  let currentDirectionTextParts: string[] = [];
  let currentDirectionHtmlParts: string[] = [];

  while (i < lines.length) {
    const text = lines[i];
    if (!text.trim()) {
      i++;
      continue;
    }

    // Handle direction blocks: start with D-<n>) and end with a line '##End Essay'
    const dirStart = isDirectionStart(text);
    if (dirStart) {
      inDirection = true;
      currentDirectionTextParts = [];
      currentDirectionHtmlParts = [];
      if (dirStart.remainder) currentDirectionTextParts.push(dirStart.remainder.trim());
      currentDirectionHtmlParts.push(htmlLines[i] || "");
      i++;
      // Accumulate additional direction paragraphs until a question header or end marker
      while (i < lines.length && !isDirectionEnd(lines[i]) && !matchQuestionStart(lines[i])) {
        currentDirectionTextParts.push(lines[i].trim());
        currentDirectionHtmlParts.push(htmlLines[i] || "");
        i++;
      }
      continue; // Next iteration will process question or end marker
    }
    if (isDirectionEnd(text)) {
      inDirection = false;
      currentDirectionTextParts = [];
      currentDirectionHtmlParts = [];
      i++;
      continue;
    }

  const qMatch = matchQuestionStart(text);
    if (!qMatch) {
      i++;
      continue;
    }

    const questionObj: any = {
      questionNumber: qNum,
      question: "",
      questionHtml: "",
  direction: inDirection ? currentDirectionTextParts.join(" ").trim() : "",
  directionHtml: inDirection ? wrapHtmlBlock(currentDirectionHtmlParts) : "",
      options: [],
      optionsHtml: [],
      answer: [],
      answerHtml: "",
      solution: "",
      solutionHtml: "",
    };

    const firstLineRemainder = qMatch.remainder?.trim() ?? "";
    const questionLines: string[] = [];
    const questionHtmlParts: string[] = [];
    if (firstLineRemainder) questionLines.push(firstLineRemainder);
    // Include full HTML of the first question line to preserve equations/formatting
    questionHtmlParts.push(htmlLines[i] || "");
    i++;

    // Accumulate question text until we encounter options/answer/solution/next question
    while (
      i < lines.length &&
      !containsAnyOption(lines[i]) &&
      !isAnswerLine(lines[i]).matched &&
      !isSolutionLine(lines[i]).matched &&
  !matchQuestionStart(lines[i])
    ) {
      questionLines.push(lines[i].trim());
      questionHtmlParts.push(htmlLines[i] || "");
      i++;
    }
    questionObj.question = questionLines.join(" ").trim();
    questionObj.questionHtml = wrapHtmlBlock(questionHtmlParts);

    // Gather options (may be multiple per paragraph)
  const options: string[] = [];
    while (
      i < lines.length &&
      !isAnswerLine(lines[i]).matched &&
      !isSolutionLine(lines[i]).matched &&
  !matchQuestionStart(lines[i])
    ) {
      const para = lines[i];
      const opts = splitOptionsFromParagraph(para);
      if (opts.length > 0) {
        options.push(...opts.map((o) => o.text));
      }
      i++;
    }
    questionObj.options = options;
    questionObj.optionsHtml = options.map((t) => `<p>${escapeHtml(t)}</p>`);

    // Answer
    if (i < lines.length && isAnswerLine(lines[i]).matched) {
      const ans = isAnswerLine(lines[i]);
      questionObj.answer = ans.letters;
      // preserve original paragraph HTML for answers
      questionObj.answerHtml = htmlLines[i] || `<p>${escapeHtml(ans.tail)}</p>`;
      i++;
    }

    // Solution
    if (i < lines.length && isSolutionLine(lines[i]).matched) {
      const sol = isSolutionLine(lines[i]);
      questionObj.solution = sol.text;
      // preserve original paragraph HTML for solutions
      questionObj.solutionHtml = htmlLines[i] || `<p>${escapeHtml(sol.text)}</p>`;
      i++;
    }

    questions.push(questionObj);
    qNum++;
  }

  return questions;
}

// Helpers
function matchQuestionStart(
  line: string,
  expectedNumber?: number
): null | { number: number; remainder: string } {
  // Accept formats: "1)", "1.", "1 -", optionally prefixed with Q or Question
  const m = line.match(/^\s*(?:Q(?:uestion)?\s*[:\.-]?\s*)?(\d+)\s*[\)\.\-:]?\s*(.*)$/i);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  if (!Number.isFinite(num)) return null;
  if (expectedNumber !== undefined && num !== expectedNumber) {
    // If numbering doesn't match expectation, still accept but treat as not a start
    // This keeps validator lenient for documents with non-sequential numbering
    return { number: num, remainder: m[2] ?? "" };
  }
  return { number: num, remainder: m[2] ?? "" };
}

type OptionEntry = { label: string; text: string };

function splitOptionsFromParagraph(text: string): OptionEntry[] {
  const line = text.trim();
  if (!line) return [];

  // Normalize spaces
  const s = line.replace(/\s+/g, " ");

  // Use a controlled approach: scan for tokens like a) / (a) / a.
  const tokens: { idx: number; label: string }[] = [];
  const patterns: RegExp[] = [
    /(?:^|\s)\(?([a-zA-Z])\)\s+/g, // (a) text or (A) text
    /(?:^|\s)([a-zA-Z])\)\s+/g, // a) text or A) text
    /(?:^|\s)([a-zA-Z])\.\s+/g, // a. text or A. text
  ];

  patterns.forEach((re) => {
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      tokens.push({ idx: m.index + (m[0].startsWith(" ") ? 1 : 0), label: m[1].toLowerCase() });
    }
  });

  // Deduplicate tokens at same index, sort by position
  const unique = Array.from(
    new Map(tokens.map((t) => [t.idx, t])).values()
  ).sort((a, b) => a.idx - b.idx);

  if (unique.length === 0) {
    // If the entire line starts like a single-labeled option without spacing variety, try simple anchors
    const m =
      s.match(/^([a-zA-Z])\)\s+(.*)$/) ||
      s.match(/^\(([a-zA-Z])\)\s+(.*)$/) ||
      s.match(/^([a-zA-Z])\.\s+(.*)$/);
    if (m) return [{ label: m[1].toLowerCase(), text: (m[2] || "").trim() }];
    return [];
  }

  const entries: OptionEntry[] = [];
  for (let i = 0; i < unique.length; i++) {
    // Determine actual start of text for this token by matching label instance at index
    // Try patterns in order to compute label length + trailing delimiter length
    const after = s.slice(unique[i].idx);
    let consumed = 0;
    const specificPatterns = [
      /^\(?([a-zA-Z])\)\s+/, // (a) 
      /^([a-zA-Z])\)\s+/, // a) 
      /^([a-zA-Z])\.\s+/, // a. 
    ];
    for (const sp of specificPatterns) {
      const m = after.match(sp);
      if (m) {
        consumed = m[0].length;
        break;
      }
    }
    const start = unique[i].idx + consumed;
    const end = i + 1 < unique.length ? unique[i + 1].idx : s.length;
    const raw = s.slice(start, end).trim();
    if (raw) entries.push({ label: unique[i].label, text: raw });
  }
  return entries;
}

function containsAnyOption(text: string): boolean {
  const s = (text || "").trim();
  if (!s) return false;
  return (
    /^\(?[a-zA-Z]\)\s+/.test(s) || // (a) 
    /^[a-zA-Z]\)\s+/.test(s) || // a)
    /^[a-zA-Z]\.\s+/.test(s) // a.
  );
}

function isAnswerLine(line: string): { matched: boolean; letters: string[]; tail: string } {
  const m = line.match(/^(?:A(?:d)?ns(?:wer)?|Correct\s*Answer)\s*[\.:\-)]+\s*(.*)$/i);
  if (!m) return { matched: false, letters: [], tail: "" };
  const tail = (m[1] || "").trim();
  const letters = Array.from(tail.matchAll(/[a-z]/gi)).map((x) => x[0].toLowerCase());
  return { matched: true, letters, tail };
}

function isSolutionLine(line: string): { matched: boolean; text: string } {
  const m = line.match(/^(?:Sol(?:ution)?|Explanation)\s*[\.:\-)]+\s*(.*)$/i);
  if (!m) return { matched: false, text: "" };
  return { matched: true, text: (m[1] || "").trim() };
}

function isDirectionStart(line: string): null | { remainder: string } {
  // Example: D-1) Directions text...  OR D-1)
  const m = line.match(/^\s*D-\d+\)\s*(.*)$/i);
  if (!m) return null;
  return { remainder: (m[1] || "").trim() };
}

function isDirectionEnd(line: string): boolean {
  return /^\s*##End\s+Essay\s*$/i.test(line || "");
}

function wrapHtmlBlock(paragraphHtmlList: string[]): string {
  const filtered = paragraphHtmlList.filter((h) => h && h.trim().length > 0);
  if (filtered.length === 0) return "";
  // Join paragraph HTML as-is; consumers can render directly
  return filtered.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
