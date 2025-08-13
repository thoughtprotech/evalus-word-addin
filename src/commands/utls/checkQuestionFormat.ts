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
        const questions = extractQuestions(lines);
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

    const qMatch = matchQuestionStart(text, expectedQ);
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

function extractQuestions(lines: string[]) {
  const questions: any[] = [];
  let i = 0;
  let qNum = 1;

  while (i < lines.length) {
    const text = lines[i];
    if (!text.trim()) {
      i++;
      continue;
    }

    const qMatch = matchQuestionStart(text, qNum);
    if (!qMatch) {
      i++;
      continue;
    }

    const questionObj: any = {
      questionNumber: qNum,
      question: "",
      options: [],
      answer: [],
      solution: "",
    };

    const firstLineRemainder = qMatch.remainder?.trim() ?? "";
    const questionLines: string[] = [];
    if (firstLineRemainder) questionLines.push(firstLineRemainder);
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
      i++;
    }
    questionObj.question = questionLines.join(" ").trim();

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

    // Answer
    if (i < lines.length && isAnswerLine(lines[i]).matched) {
      const ans = isAnswerLine(lines[i]);
      questionObj.answer = ans.letters;
      i++;
    }

    // Solution
    if (i < lines.length && isSolutionLine(lines[i]).matched) {
      const sol = isSolutionLine(lines[i]);
      questionObj.solution = sol.text;
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
    const m = s.match(/^([a-eA-E])\)\s+(.*)$/) || s.match(/^\(([a-eA-E])\)\s+(.*)$/) || s.match(/^([a-eA-E])\.\s+(.*)$/);
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

function isAnswerLine(line: string): { matched: boolean; letters: string[] } {
  const m = line.match(/^(?:Ans(?:wer)?|Correct\s*Answer)\s*[\.:\-)]+\s*(.*)$/i);
  if (!m) return { matched: false, letters: [] };
  const tail = (m[1] || "").trim();
  const letters = Array.from(tail.matchAll(/[a-e]/gi)).map((x) => x[0].toLowerCase());
  return { matched: true, letters };
}

function isSolutionLine(line: string): { matched: boolean; text: string } {
  const m = line.match(/^(?:Sol(?:ution)?|Explanation)\s*[\.:\-)]+\s*(.*)$/i);
  if (!m) return { matched: false, text: "" };
  return { matched: true, text: (m[1] || "").trim() };
}
