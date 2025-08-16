import React, { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import QuestionPreview from "./components/QuestionPreview";
import { submitQuestions } from "../apis/startPageAPIs";

// ---- Types ----
type PatternField = { value: string; label: string };

interface FormData {
  question: PatternField;
  option: PatternField;
  solution: PatternField;
  answer: PatternField;
}
interface Question {
  questionNumber: number;
  question: string;
  options: string[];
  answer: string[];
  solution: string;
  direction?: string;
  directionHtml?: string;
  // HTML fields from extraction to preserve equations/formatting
  questionHtml?: string;
  optionsHtml?: string[];
  answerHtml?: string;
  solutionHtml?: string;
  questionDifficultyId?: number;
  allowCandidateComments?: boolean;
  marks: string;
  negativeMarks: string;
  graceMarks: string;
  language: string;
  subject: string;
  topic: string;
}

// ---- Main ----
const Dialog = () => {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    Office.onReady(() => {
      Office.context.ui.messageParent("dialogReady");
      Office.context.ui.addHandlerAsync(Office.EventType.DialogParentMessageReceived, (arg) => {
        (async () => {
          try {
            const received = JSON.parse(arg.message);
            const formData: FormData = JSON.parse(received.form);
            let qs: Question[] = JSON.parse(received.questions);
            // Set raw first; defaults will be applied in a later effect
            qs = await inlineAllQuestionHtml(qs);
            setFormData(formData);
            setQuestions(qs);
          } catch {
            setFormData(null);
            setQuestions([]);
          }
        })();
      });
    });
  }, []);

  const createQuestions = async () => {
    const payload = questions.map((q) => ({
      questionNumber: q.questionNumber,
      question: q.questionHtml,
      options: q.optionsHtml,
      answer: q.answerHtml,
      solution: q.solutionHtml,
      subjectId: q.subject,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      graceMarks: q.graceMarks,
      questionDifficultyLevelId: q.questionDifficultyId,
      language: q.language,
      sectionId: 0,
      allowCandidateComments: true,
      questionTypeId: 1,
    }));

    const { status } = await submitQuestions(payload);

    if (status === 201) {
      toast.success("Questions Saved");
    } else {
      toast.error("Something Went Wrong");
    }
  };

  const createTest = async () => {};

  return (
    <div className="p-4 bg-white rounded-lg shadow-md w-full min-h-screen overflow-auto font-sans text-sm">
      <QuestionPreview
        questions={questions}
        setQuestions={setQuestions}
        createQuestions={createQuestions}
        createTest={createTest}
      />
      <Toaster />
    </div>
  );
};

export default Dialog;

// ---- HTML helpers: sanitize and inline images as data URLs ----
async function inlineAllQuestionHtml(qs: Question[]): Promise<Question[]> {
  const result: Question[] = [];
  for (const q of qs) {
    const directionHtml = q.directionHtml
      ? await sanitizeAndInlineImages(q.directionHtml)
      : q.directionHtml;
    const questionHtml = q.questionHtml
      ? await sanitizeAndInlineImages(q.questionHtml)
      : q.questionHtml;
    const optionsHtml = q.optionsHtml
      ? await Promise.all(q.optionsHtml.map((h) => sanitizeAndInlineImages(h)))
      : q.optionsHtml;
    const answerHtml = q.answerHtml ? await sanitizeAndInlineImages(q.answerHtml) : q.answerHtml;
    const solutionHtml = q.solutionHtml
      ? await sanitizeAndInlineImages(q.solutionHtml)
      : q.solutionHtml;
    result.push({ ...q, directionHtml, questionHtml, optionsHtml, answerHtml, solutionHtml });
  }
  return result;
}

async function sanitizeAndInlineImages(html: string): Promise<string> {
  if (!html) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Remove script tags
  doc.querySelectorAll("script").forEach((el) => el.remove());
  // Remove event handlers
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    }
  });
  const imgs = Array.from(doc.images || []);
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:")) return;
      try {
        const dataUrl = await fetchToDataUrl(src);
        if (dataUrl) img.setAttribute("src", dataUrl);
      } catch {
        // ignore fetch failures, keep original src
      }
    })
  );
  return doc.body.innerHTML;
}

async function fetchToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
