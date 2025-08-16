import React, { useEffect, useState } from "react";
import { CheckCircle, FileQuestion, Lightbulb, Settings, Eye, Trash2 } from "lucide-react";
import { TextOrHtml } from "./TextOrHtml";

interface Option {
  value: string | number;
  label: string;
}
interface Question {
  questionNumber: number;
  question: string;
  options: string[];
  answer: string[];
  solution: string;
  optionsHtml?: string[];
  answerHtml?: string;
  solutionHtml?: string;
  marks: string;
  negativeMarks: string;
  graceMarks: string;
  language: string;
  subject?: string;
  topic?: string;
  questionDifficultyId?: number | string; // Accept string as well, since select value is string
  chapter?: string;
  subtopic?: string;
}
interface BulkActionPreview {
  rangeStart: number;
  rangeEnd: number;
  values: BulkValues;
}
interface BulkValues {
  marks: string;
  negativeMarks: string;
  graceMarks: string;
  language: string;
  questionDifficultyId: string;
  subject: string;
  chapter: string;
  topic: string;
  subtopic: string;
}
const API_BASE = "https://evalusdevapi.thoughtprotraining.com/api";

// API Calls
const fetchLanguages = async (): Promise<Option[]> => {
  const res = await fetch(`${API_BASE}/Languages`);
  const data = await res.json();
  return data.data.map((lang: any) => ({
    value: lang.language,
    label: lang.language,
  }));
};
const fetchDifficulties = async (): Promise<Option[]> => {
  const res = await fetch(`${API_BASE}/QuestionDifficultyLevels?includeInactive=false`);
  const data = await res.json();
  return data.data.map((diff: any) => ({
    value: diff.questionDifficultylevelId,
    label: diff.questionDifficultylevel1,
  }));
};
const fetchSubjects = async (): Promise<Option[]> => {
  const res = await fetch(`${API_BASE}/Subjects?includeInactive=false`);
  const data = await res.json();
  return data.data
    .filter((sub: any) => sub.subjectType === "Subject")
    .map((subject: any) => ({
      value: subject.subjectId,
      label: subject.subjectName,
    }));
};
const fetchChildren = async (parentId: number): Promise<Option[]> => {
  const res = await fetch(`${API_BASE}/Subjects?includeInactive=false`);
  const data = await res.json();
  return data.data
    .filter((child: any) => child.parentId === parentId)
    .map((child: any) => ({
      value: child.subjectId,
      label: child.subjectName,
    }));
};

export default function QuestionPreview({
  questions,
  setQuestions,
  createQuestions,
  createTest,
}: {
  questions: Question[];
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>;
  createQuestions: any;
  createTest: any;
}) {
  const [languages, setLanguages] = useState<Option[]>([]);
  const [difficulties, setDifficulties] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [chapters, setChapters] = useState<Option[]>([]);
  const [topics, setTopics] = useState<Option[]>([]);
  const [subtopics, setSubtopics] = useState<Option[]>([]);
  // Store all fetched chapters, topics, subtopics globally to keep labels for preview after clearing selection
  const [allChapters, setAllChapters] = useState<Option[]>([]);
  const [allTopics, setAllTopics] = useState<Option[]>([]);
  const [allSubtopics, setAllSubtopics] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);

  // Range selection
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [bulkValues, setBulkValues] = useState<BulkValues>({
    marks: "",
    negativeMarks: "",
    graceMarks: "",
    language: "",
    questionDifficultyId: "",
    subject: "",
    chapter: "",
    topic: "",
    subtopic: "",
  });
  const [bulkActionPreview, setBulkActionPreview] = useState<BulkActionPreview[]>([]);
  // Validation error state
  const [error, setError] = useState<string>("");

  // Load dropdowns initially
  useEffect(() => {
    fetchLanguages().then(setLanguages);
    fetchDifficulties().then(setDifficulties);
    fetchSubjects().then(setSubjects);
  }, []);

  // Add new options to global "all" arrays avoiding duplicates
  const addToAllOptions = (
    setter: React.Dispatch<React.SetStateAction<Option[]>>,
    newOptions: Option[]
  ) => {
    setter((prev) => {
      const existing = new Set(prev.map((opt) => opt.value));
      return [...prev, ...newOptions.filter((opt) => !existing.has(opt.value))];
    });
  };

  // Handle dropdown cascading with global "all" arrays update
  const handleCascade = async (field: string, value: string) => {
    if (field === "subject") {
      setChapters([]);
      setTopics([]);
      setSubtopics([]);
      if (value) {
        setLoading(true);
        fetchChildren(Number(value))
          .then((fetched) => {
            setChapters(fetched);
            addToAllOptions(setAllChapters, fetched);
          })
          .finally(() => setLoading(false));
      }
    }
    if (field === "chapter") {
      setTopics([]);
      setSubtopics([]);
      if (value) {
        setLoading(true);
        fetchChildren(Number(value))
          .then((fetched) => {
            setTopics(fetched);
            addToAllOptions(setAllTopics, fetched);
          })
          .finally(() => setLoading(false));
      }
    }
    if (field === "topic") {
      setSubtopics([]);
      if (value) {
        setLoading(true);
        fetchChildren(Number(value))
          .then((fetched) => {
            setSubtopics(fetched);
            addToAllOptions(setAllSubtopics, fetched);
          })
          .finally(() => setLoading(false));
      }
    }
  };

  const handleBulkValueChange = (field: keyof BulkValues, value: string) => {
    setBulkValues((prev) => ({
      ...prev,
      [field]: value,
    }));
    handleCascade(field, value);
  };

  // Check if new range overlaps any previous ranges
  const doesRangeOverlap = (start: number, end: number): boolean => {
    return bulkActionPreview.some(
      (action) =>
        (start >= action.rangeStart && start <= action.rangeEnd) ||
        (end >= action.rangeStart && end <= action.rangeEnd) ||
        (start <= action.rangeStart && end >= action.rangeEnd)
    );
  };

  // Validate mandatory fields and range
  const validateBulkSettings = (): boolean => {
    if (!rangeStart || !rangeEnd) {
      setError("Please enter valid 'From Q#' and 'To Q#'.");
      return false;
    }
    if (rangeStart < 1 || rangeEnd > questions.length || rangeStart > rangeEnd) {
      setError("Please enter a valid range within questions.");
      return false;
    }
    if (doesRangeOverlap(rangeStart, rangeEnd)) {
      setError("The specified range overlaps with a previously set range.");
      return false;
    }
    // Mandatory fields (except subtopic)
    if (
      !bulkValues.marks.trim() ||
      !bulkValues.negativeMarks.trim() ||
      !bulkValues.graceMarks.trim() ||
      !bulkValues.language.trim() ||
      !bulkValues.questionDifficultyId.trim() ||
      !bulkValues.subject.trim() ||
      !bulkValues.chapter.trim() ||
      !bulkValues.topic.trim()
    ) {
      setError("Please fill all mandatory fields except Subtopic before applying.");
      return false;
    }
    setError("");
    return true;
  };

  // Apply bulk for chosen range, then clear fields and store preview
  const applyBulkToRange = () => {
    if (!validateBulkSettings()) return;

    setQuestions((prev) =>
      prev.map((q) => {
        if (q.questionNumber >= rangeStart! && q.questionNumber <= rangeEnd!) {
          return {
            ...q,
            ...bulkValues,
            questionDifficultyId: bulkValues.questionDifficultyId || undefined,
          };
        }
        return q;
      })
    );

    setBulkActionPreview((prev) => [
      ...prev,
      {
        rangeStart: rangeStart!,
        rangeEnd: rangeEnd!,
        values: { ...bulkValues },
      },
    ]);
    // Clear fields for next bulk action
    setRangeStart(null);
    setRangeEnd(null);
    setBulkValues({
      marks: "",
      negativeMarks: "",
      graceMarks: "",
      language: "",
      questionDifficultyId: "",
      subject: "",
      chapter: "",
      topic: "",
      subtopic: "",
    });
    setChapters([]);
    setTopics([]);
    setSubtopics([]);
  };

  // Allow preview removal (optional)
  const removePreviewEntry = (idx: number) => {
    setBulkActionPreview((prev) => {
      // Get the entry being removed
      const toRemove = prev[idx];
      if (!toRemove) return prev; // fallback safety

      // Remove the entry visually
      const newPreview = prev.filter((_, i) => i !== idx);

      // Clear affected values in questions state
      setQuestions((prevQuestions) =>
        prevQuestions.map((q) => {
          if (q.questionNumber >= toRemove.rangeStart && q.questionNumber <= toRemove.rangeEnd) {
            // For every key that was set in that bulk, clear the value if it matches
            // (This handles only clearing the fields that were set in the bulk)
            const cleared: any = { ...q };
            Object.keys(toRemove.values).forEach((key) => {
              // Only clear if this field matches the value from the removed bulk action
              if (
                toRemove.values[key as keyof BulkValues] !== "" &&
                cleared[key] === toRemove.values[key as keyof BulkValues]
              ) {
                cleared[key] = "";
              }
            });
            return cleared;
          }
          return q;
        })
      );

      setError(""); // Reset any errors maybe caused due to overlap
      return newPreview;
    });
  };

  function areAllQuestionsComplete(questions: Question[]): boolean {
    return questions.every(
      (q) =>
        q.marks?.trim() &&
        q.negativeMarks?.trim() &&
        q.graceMarks?.trim() &&
        q.language?.trim() &&
        q.questionDifficultyId !== undefined &&
        q.questionDifficultyId !== "" &&
        q.subject?.trim() &&
        q.chapter?.trim() &&
        q.topic?.trim()
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 rounded-md p-6 space-y-6 overflow-auto">
      <div className="sticky top-0 flex flex-col gap-5">
        {/* Header */}
        <div className="z-10 flex justify-between items-center bg-white border-b shadow-sm px-4 py-3 rounded-md">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileQuestion className="w-5 h-5 text-indigo-600" />
            Preview Questions
          </h1>
          <div className="flex gap-2">
            <button
              type="button"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow"
              onClick={() => {
                if (!areAllQuestionsComplete(questions)) {
                  setError(
                    "All questions must have marks, negative marks, grace marks, language, difficulty, subject, chapter, and topic set before you can create questions."
                  );
                  return;
                }
                setError(""); // Clear any previous error
                createQuestions();
              }}
            >
              Save Questions
            </button>
            <button
              type="button"
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow"
              onClick={() => {
                if (!areAllQuestionsComplete(questions)) {
                  setError(
                    "All questions must have marks, negative marks, grace marks, language, difficulty, subject, chapter, and topic set before you can create the test."
                  );
                  return;
                }
                setError("");
                createTest();
              }}
            >
              Save Questions & Test
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 text-red-700 px-3 py-2 rounded-md text-sm font-medium w-full mx-auto">
            {error}
          </div>
        )}

        {/* Bulk Settings */}
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 p-4 w-full mx-auto">
          <div className="flex w-full justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-600" />
              Bulk Settings
            </h2>

            <button
              type="button"
              className="bg-indigo-600 hover:bg-indigo-700 w-fit border rounded-lg px-2 text-sm focus:ring-2 focus:ring-indigo-500 text-white py-1 font-semibold cursor-pointer"
              disabled={
                !rangeStart || !rangeEnd || rangeStart > rangeEnd || rangeEnd > questions.length
              }
              onClick={applyBulkToRange}
            >
              Apply
            </button>
          </div>
          {/* Question Range Selection */}
          <div className="flex items-center gap-4 mb-4">
            <div>
              <label className="block mb-1 text-gray-600">From Q#</label>
              <input
                type="number"
                min={1}
                max={questions.length}
                value={rangeStart ?? ""}
                onChange={(e) => setRangeStart(e.target.value ? Number(e.target.value) : null)}
                className="w-fit border rounded-lg px-2 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-600">To Q#</label>
              <input
                type="number"
                min={1}
                max={questions.length}
                value={rangeEnd ?? ""}
                onChange={(e) => setRangeEnd(e.target.value ? Number(e.target.value) : null)}
                className="w-fit border rounded-lg px-2 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          {/* Inputs */}
          <div className="flex flex-wrap gap-4 text-sm">
            {/* Number Inputs */}
            {[
              { label: "Marks", key: "marks" },
              { label: "Negative Marks", key: "negativeMarks" },
              { label: "Grace Marks", key: "graceMarks" },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block mb-1 text-gray-600 font-bold text-xs">{label}</label>
                <input
                  type="number"
                  className="w-28 border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                  value={bulkValues[key as keyof BulkValues]}
                  onChange={(e) => handleBulkValueChange(key as keyof BulkValues, e.target.value)}
                />
              </div>
            ))}
            {/* Language */}
            <div>
              <label className="block mb-1 text-gray-600 font-bold text-xs">Language</label>
              <select
                className="w-fit border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                value={bulkValues.language}
                onChange={(e) => handleBulkValueChange("language", e.target.value)}
              >
                <option value="">Select Language</option>
                {languages.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Difficulty */}
            <div>
              <label className="block mb-1 text-gray-600 font-bold text-xs">Difficulty</label>
              <select
                className="w-fit border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                value={bulkValues.questionDifficultyId}
                onChange={(e) => handleBulkValueChange("questionDifficultyId", e.target.value)}
              >
                <option value="">Select Difficulty</option>
                {difficulties.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Subject */}
            <div>
              <label className="block mb-1 text-gray-600 font-bold text-xs">Subject</label>
              <select
                className="w-fit border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                value={bulkValues.subject}
                onChange={(e) => handleBulkValueChange("subject", e.target.value)}
              >
                <option value="">Select Subject</option>
                {subjects.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Chapter */}
            <div>
              <label className="block mb-1 text-gray-600 font-bold text-xs">Chapter</label>
              <select
                className="w-fit border rounded-lg px-2 py-1.5 text-sm"
                value={bulkValues.chapter}
                onChange={(e) => handleBulkValueChange("chapter", e.target.value)}
                disabled={!bulkValues.subject}
              >
                <option value="">{loading ? "Loading..." : "Select Chapter"}</option>
                {chapters.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Topic */}
            <div>
              <label className="block mb-1 text-gray-600 font-bold text-xs">Topic</label>
              <select
                className="w-fit border rounded-lg px-2 py-1.5 text-sm"
                value={bulkValues.topic}
                onChange={(e) => handleBulkValueChange("topic", e.target.value)}
                disabled={!bulkValues.chapter}
              >
                <option value="">{loading ? "Loading..." : "Select Topic"}</option>
                {topics.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Subtopic */}
            <div>
              <label className="block mb-1 text-gray-600 font-bold text-xs">Subtopic</label>
              <select
                className="w-fit border rounded-lg px-2 py-1.5 text-sm"
                value={bulkValues.subtopic}
                onChange={(e) => handleBulkValueChange("subtopic", e.target.value)}
                disabled={!bulkValues.topic}
              >
                <option value="">{loading ? "Loading..." : "Select Subtopic"}</option>
                {subtopics.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Action Preview */}
        {bulkActionPreview.length > 0 && (
          <div className="bg-white border border-gray-300 rounded-lg shadow-sm w-full mx-auto mb-4">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Eye className="w-5 h-5 text-green-600" />
                Bulk Settings Preview
              </h2>
              <span className="text-xs text-gray-500 font-medium">
                {bulkActionPreview.length} {bulkActionPreview.length === 1 ? "entry" : "entries"}
              </span>
            </div>
            <ul className="max-h-52 overflow-y-auto divide-y divide-gray-200">
              {bulkActionPreview.map((action, idx) => (
                <li
                  key={idx}
                  className="flex items-start justify-between px-4 py-2 hover:bg-gray-50 transition"
                  title={`Range: Q${action.rangeStart} to Q${action.rangeEnd}`}
                >
                  <div className="flex-1 min-w-0 text-xs text-gray-900 leading-snug">
                    <span className="font-semibold text-indigo-700 mr-1">
                      Q){action.rangeStart} - Q){action.rangeEnd}
                    </span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {Object.entries(action.values)
                        .filter(([, val]) => !!val)
                        .map(([key, val]) => {
                          let displayVal: string | number = val;
                          if (key === "language") {
                            const found = languages.find((l) => l.value === val);
                            if (found) displayVal = found.label;
                          } else if (key === "questionDifficultyId") {
                            const found = difficulties.find((d) => String(d.value) === val);
                            if (found) displayVal = found.label;
                          } else if (key === "subject") {
                            const found = subjects.find((s) => String(s.value) === val);
                            if (found) displayVal = found.label;
                          } else if (key === "chapter") {
                            const found = allChapters.find((c) => String(c.value) === val);
                            if (found) displayVal = found.label;
                          } else if (key === "topic") {
                            const found = allTopics.find((t) => String(t.value) === val);
                            if (found) displayVal = found.label;
                          } else if (key === "subtopic") {
                            const found = allSubtopics.find((st) => String(st.value) === val);
                            if (found) displayVal = found.label;
                          }

                          // Choose colors per key (like in question card)
                          const colorMap: Record<string, string> = {
                            marks: "bg-indigo-400/10 text-indigo-700",
                            negativeMarks: "bg-indigo-400/10 text-indigo-600",
                            graceMarks: "bg-indigo-400/10 text-indigo-600",
                            language: "bg-indigo-400/10 text-indigo-600",
                            questionDifficultyId: "bg-indigo-400/10 text-indigo-600",
                            subject: "bg-indigo-400/10 text-indigo-600",
                            chapter: "bg-indigo-400/10 text-indigo-600",
                            topic: "bg-indigo-400/10 text-indigo-600",
                            subtopic: "bg-indigo-400/10 text-indigo-600",
                          };

                          return (
                            <span
                              key={key}
                              className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${colorMap[key] || "bg-gray-100 text-gray-600"}`}
                            >
                              <span className="capitalize text-xs">
                                {key === "marks"
                                  ? "Marks"
                                  : key === "negativeMarks"
                                    ? "Negative Marks"
                                    : key === "graceMarks"
                                      ? "Grace Marks"
                                      : ""}
                              </span>
                              {displayVal}
                            </span>
                          );
                        })}
                    </div>
                  </div>
                  <button
                    className="ml-3 shrink-0 text-gray-400 hover:text-red-600 focus:outline-none"
                    onClick={() => removePreviewEntry(idx)}
                    aria-label="Remove Preview Entry"
                    title="Remove this preview entry"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="grid grid-cols-2 gap-4">
        {questions.length > 0 ? (
          questions.map((q) => (
            <div
              key={q.questionNumber}
              className="bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-xl transition-all duration-300 p-5 relative overflow-hidden flex flex-col justify-between"
            >
              {/* Decorative accent */}
              <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-indigo-500 to-blue-400 rounded-l-xl"></div>

              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-1 rounded-lg shadow-sm">
                  {q.questionNumber}
                </span>
                <TextOrHtml content={q.question} />
              </div>

              {/* Options */}
              <ul className="grid grid-cols-2 gap-x-6 gap-y-2 ml-6 text-sm text-gray-700 mb-4">
                {q.optionsHtml.map((opt, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 group hover:text-indigo-600 transition bg-indigo-400/10 rounded-md px-4 py-1"
                  >
                    <span className="text-indigo-600 font-semibold group-hover:scale-110 transition-transform">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <TextOrHtml content={opt} />
                  </li>
                ))}
              </ul>

              {/* Answer & Solution */}
              <div className="ml-6 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span className="flex items-center gap-2">
                    Correct Answer: <TextOrHtml content={q.answer.join(", ").toUpperCase()} />
                  </span>
                </div>
                {q.solution.length !== 0 && (
                  <div className="flex items-start gap-2 text-gray-600 leading-relaxed">
                    <Lightbulb className="w-4 h-4 text-yellow-500 shrink-0 mt-1" />
                    <TextOrHtml content={q.solution} />
                  </div>
                )}
              </div>

              {/* Settings */}
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                {q.marks && (
                  <div className="w-fit text-indigo-600 flex rounded-full bg-indigo-400/10 px-2 py-1 gap-2">
                    <h1 className="font-bold text-xs">Marks</h1>
                    <h1 className="font-bold text-xs">{q.marks}</h1>
                  </div>
                )}
                {q.negativeMarks && (
                  <div className="w-fit text-indigo-600 flex rounded-full bg-indigo-400/10 px-2 py-1 gap-2">
                    <h1 className="font-bold text-xs">Negative Marks</h1>
                    <h1 className="font-bold text-xs">{q.negativeMarks}</h1>
                  </div>
                )}
                {q.graceMarks && (
                  <div className="w-fit text-indigo-600 flex rounded-full bg-indigo-400/10 px-2 py-1 gap-2">
                    <h1 className="font-bold text-xs">Grace Marks</h1>
                    <h1 className="font-bold text-xs">{q.graceMarks}</h1>
                  </div>
                )}
                {q.language && (
                  <div className="w-fit text-indigo-600 flex rounded-full bg-indigo-400/10 px-2 py-1 gap-2">
                    {/* <h1 className="text-xs">Language</h1> */}
                    <h1 className="font-bold text-xs">{q.language}</h1>
                  </div>
                )}
                {q.questionDifficultyId && (
                  <div className="w-fit text-indigo-600 flex rounded-full bg-indigo-400/10 px-2 py-1 gap-2">
                    <h1 className="font-bold text-xs">
                      {difficulties.find((d) => String(d.value) === q.questionDifficultyId).label}
                    </h1>
                  </div>
                )}
                {q.topic && (
                  <div className="w-fit text-indigo-600 flex rounded-full bg-indigo-400/10 px-2 py-1 gap-2">
                    <h1 className="font-bold text-xs">
                      {allTopics.find((t) => String(t.value) === q.topic).label}
                    </h1>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-gray-500 text-sm bg-white rounded-xl border">
            No questions found.
          </div>
        )}
      </div>
    </div>
  );
}
