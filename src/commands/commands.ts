/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/* global Office, Word */

Office.onReady(() => {
  // If needed, Office.js is ready to be called.
});

/**
 * Shows a notification when the add-in command is executed.
 * @param event
 */
function action(event: Office.AddinCommands.Event) {
  const message: Office.NotificationMessageDetails = {
    type: Office.MailboxEnums.ItemNotificationMessageType.InformationalMessage,
    message: "Performed action.",
    icon: "Icon.80x80",
    persistent: true,
  };

  // Show a notification message.
  Office.context.mailbox.item?.notificationMessages.replaceAsync(
    "ActionPerformanceNotification",
    message
  );

  event.completed();
}

// Register the existing action
Office.actions.associate("action", action);

// ─── YOUR NEW checkFormat COMMAND ───────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────
// Validate and color-format the document
// ──────────────────────────────────────────────────────────────

async function checkFormat(event: Office.AddinCommands.Event) {
  try {
    await Word.run(async (context) => {
      const paras = context.document.body.paragraphs;
      paras.load("items");
      await context.sync();

      const lines = paras.items.map((p) => p.text.trim());
      const invalidSet = new Set(findInvalidParagraphs(lines));

      // Reset all to default black
      paras.items.forEach((p) => {
        p.font.color = "black";
      });

      // Color paragraphs based on validity
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
        console.log("Extracted Questions JSON:", questions);
        await OfficeRuntime.storage.setItem("lastExtractedJson", JSON.stringify(questions));
      } else {
        Office.context.ui.messageParent("Document contains format errors. JSON not generated.");
      }
    });
  } catch (err: any) {
    console.error("Error during checkFormat:", err.message);
  } finally {
    event.completed();
  }
}

Office.actions.associate("checkFormat", checkFormat);

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
    const qRegex = new RegExp(`^${qNum}\\)\\s+`);
    if (!qRegex.test(text)) {
      invalid.push(i);
    }
    i++;

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

    const qRegex = new RegExp(`^${qNum}\\)\\s+(.*)`);
    const match = text.match(qRegex);
    if (match) {
      questionObj.question = match[1].trim();
    }
    i++;

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

// Register your checkFormat function
Office.actions.associate("checkFormat", checkFormat);
