export default async function checkFormatHelper(): Promise<{ success: boolean; message?: string }> {
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
  if (lines.length === 0) {
    return [0];
  }

  let i = 0;
  let qNum = 1;

  while (i < lines.length) {
    const text = lines[i];

    // Skip empty
    if (!text.trim()) {
      i++;
      continue;
    }

    // 1) Question line
    const qStartRegex = new RegExp(`^${qNum}\\)\\s+`);
    if (!qStartRegex.test(text)) {
      invalid.push(i);
      i++;
      continue;
    }

    i++; // Move to next line after matched question start

    // Skip any lines until the first valid option or answer or end
    while (
      i < lines.length &&
      !/^[a-z]\)\s+/i.test(lines[i]) &&
      !/^Ans\)/i.test(lines[i]) &&
      !/^Adns\)/i.test(lines[i]) &&
      !/^\[Image:.*\]$/i.test(lines[i])
    ) {
      i++;
    }

    // 2) Options
    const opts: string[] = [];
    const optIndices: number[] = [];

    while (i < lines.length && !/^Ans\)/i.test(lines[i]) && !/^Adns\)/i.test(lines[i])) {
      const para = lines[i].trim();
      if (/^\[Image:.*\]$/i.test(para) || para === "") {
        i++;
        continue;
      }

      const label = String.fromCharCode(97 + opts.length); // a, b, ...
      const optRegex = new RegExp(`^${label}\\)\\s+`);
      if (!optRegex.test(para)) {
        invalid.push(i);
      }

      opts.push(para);
      optIndices.push(i);
      i++;
    }

    if (opts.length === 0) {
      invalid.push(i);
    }

    // 3) Answer line
    if (i >= lines.length || !/^Ans\)/i.test(lines[i])) {
      invalid.push(i);
    } else {
      const answerPart = lines[i].replace(/^Ans\)\s*/i, "");
      const answers = answerPart
        .split(",")
        .map((a) => a.trim().toLowerCase())
        .filter((a) => a);
      if (answers.length === 0) {
        invalid.push(i);
      } else {
        answers.forEach((ans) => {
          if (!/^[a-z]$/.test(ans)) {
            invalid.push(i);
          } else {
            const idx = ans.charCodeAt(0) - 97;
            if (idx < 0 || idx >= opts.length) {
              invalid.push(i);
            }
          }
        });
      }
    }
    i++;

    // 4) Optional solution
    if (i < lines.length && /^Sol\)/i.test(lines[i])) {
      i++;
    }

    qNum++;
  }

  return invalid;
}

function extractQuestions(lines: string[]) {
  const questions: any[] = [];
  let i = 0;
  let qNum = 1;

  while (i < lines.length) {
    const questionObj: any = {
      questionNumber: qNum,
      question: "",
      options: [],
      answer: [],
      solution: "",
    };

    const text = lines[i];
    if (!text.trim()) {
      i++;
      continue;
    }

    const qStartRegex = new RegExp(`^${qNum}\\)\\s+(.*)`);
    const match = lines[i].match(qStartRegex);
    if (!match) {
      i++;
      continue;
    }

    const questionLines = [match[1].trim()];
    i++;

    // Accumulate all lines until we reach an option (a), answer, or image line
    while (
      i < lines.length &&
      !/^[a-z]\)\s+/i.test(lines[i]) &&
      !/^Ans\)/i.test(lines[i]) &&
      !/^Adns\)/i.test(lines[i]) &&
      !/^\[Image:.*\]$/i.test(lines[i])
    ) {
      questionLines.push(lines[i].trim());
      i++;
    }

    questionObj.question = questionLines.join(" ");

    const options: string[] = [];
    while (i < lines.length && !/^Ans\)/i.test(lines[i]) && !/^Adns\)/i.test(lines[i])) {
      const optLine = lines[i].trim();

      if (/^\[Image:.*\]$/i.test(optLine)) {
        options.push(optLine); // Optional: Keep image placeholders
      } else if (/^[a-z]\)\s+/i.test(optLine)) {
        const optText = optLine.replace(/^[a-z]\)\s+/i, "").trim();
        options.push(optText);
      }
      i++;
    }

    questionObj.options = options;

    if (i < lines.length && /^Ans\)/i.test(lines[i])) {
      const ansText = lines[i].replace(/^Ans\)\s*/i, "");
      const ansList = ansText.split(",").map((a) => a.trim().toLowerCase());
      questionObj.answer = ansList;
      i++;
    }

    if (i < lines.length && /^Sol\)/i.test(lines[i])) {
      questionObj.solution = lines[i].replace(/^Sol\)\s*/i, "").trim();
      i++;
    }

    questions.push(questionObj);
    qNum++;
  }

  return questions;
}
