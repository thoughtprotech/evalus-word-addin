import React, { useEffect, useState } from "react";
import {
  Plus,
  MinusCircle,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Layers,
  Hash,
  ListOrdered,
  ClipboardList,
  Clock3,
  Users,
  Dot,
  PercentCircle,
  CheckCircle,
  Info,
  Languages,
  Scale,
  Minus,
  ListChecks,
  List,
  AlignLeft,
  Target,
  Lightbulb,
  MessageSquare,
  Settings2,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

// ---- Types ----
interface FormData {
  testName: string;
  testType: string;
  testCode: string;
  category: string;
  instructions: string;
  duration: string;
  handicappedDuration: string;
  totalQuestions: string;
  totalMarks: string;
  testDifficultyLevel1: string;
}
interface Question {
  questionNumber: number;
  question: string;
  options: string[];
  answer: string[];
  solution: string;
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
}
interface Difficulty {
  questionDifficultylevelId: number;
  questionDifficultylevel1: string;
}
interface Subject {
  subjectId: number;
  subjectName: string;
  parentId: number;
}
interface Language {
  language: string;
}

// ---- Test Details Component ----
const detailIcons: Record<string, JSX.Element> = {
  testName: <FileText size={16} className="text-indigo-400" />,
  testType: <Layers size={16} className="text-sky-400" />,
  testCode: <Hash size={16} className="text-emerald-400" />,
  category: <ListOrdered size={16} className="text-orange-400" />,
  instructions: <ClipboardList size={16} className="text-purple-400" />,
  duration: <Clock3 size={16} className="text-blue-400" />,
  handicappedDuration: <Users size={16} className="text-indigo-400" />,
  totalQuestions: <Dot size={16} className="text-teal-400" />,
  totalMarks: <PercentCircle size={16} className="text-green-400" />,
  difficulty: <CheckCircle size={16} className="text-rose-400" />,
};

function TestDetails({
  formData,
  testTypes,
  categories,
  instructionsList,
  testdifficulties,
}: {
  formData: FormData;
  testTypes: any[];
  categories: any[];
  instructionsList: any[];
  testdifficulties: any[];
}) {
  const entries = [
    { key: "testName", label: "Test Name", value: formData.testName },
    {
      key: "testType",
      label: "Test Type",
      value: testTypes.find((t) => String(t.testTypeId) === String(formData.testType))?.testType1,
    },
    { key: "testCode", label: "Test Code", value: formData.testCode },
    {
      key: "category",
      label: "Category",
      value: categories.find((c) => String(c.testCategoryId) === String(formData.category))
        ?.testCategoryName,
    },
    {
      key: "instructions",
      label: "Instructions",
      value: instructionsList.find(
        (i) => String(i.testInstructionId) === String(formData.instructions)
      )?.testInstructionName,
    },
    { key: "duration", label: "Duration", value: formData.duration },
    {
      key: "handicappedDuration",
      label: "Handicapped Duration",
      value: formData.handicappedDuration,
    },
    {
      key: "totalQuestions",
      label: "Total Questions",
      value: formData.totalQuestions,
    },
    { key: "totalMarks", label: "Total Marks", value: formData.totalMarks },
    {
      key: "difficulty",
      label: "Difficulty",
      value: testdifficulties.find(
        (d) => String(d.testDifficultyLevelId) === String(formData.testDifficultyLevel1)
      )?.testDifficultyLevel1,
    },
  ];

  return (
    <section className="mb-4 bg-white/70 rounded-lg border border-gray-100 shadow-sm">
      <h2 className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-gray-50 text-sm font-semibold text-indigo-700">
        <Info size={18} className="text-indigo-500" /> Test Details
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 p-4">
        {entries.map(({ key, label, value }) => (
          <div
            key={key}
            className="flex items-start gap-3 bg-white rounded-md border border-gray-100 p-2 hover:shadow-sm transition"
          >
            <div className="flex-shrink-0 w-5 h-5 mt-0.5 text-indigo-500">
              {detailIcons[key] || null}
            </div>
            <div className="flex flex-col w-full min-w-0">
              <span className="text-xs font-medium text-gray-500">{label}</span>
              <span className="text-sm font-semibold text-indigo-900 truncate">
                {value || <span className="italic text-gray-300">-</span>}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Question Card Component ----
function QuestionCard({
  q,
  qIndex,
  questionsLength,
  difficulties,
  languages,
  handleQuestionChange,
  handleOptionChange,
  toggleAnswer,
  handleDifficultyChange,
  handleAllowCommentsChange,
  handleQuestionFieldChange,
  addOption,
  removeOption,
  removeQuestion,
}: {
  q: Question;
  qIndex: number;
  questionsLength: number;
  difficulties: Difficulty[];
  languages: Language[];
  handleQuestionChange: (qIndex: number, field: "question" | "solution", value: string) => void;
  handleOptionChange: (qIndex: number, optIndex: number, value: string) => void;
  toggleAnswer: (qIndex: number, optionValue: string) => void;
  handleDifficultyChange: (qIndex: number, value: string) => void;
  handleAllowCommentsChange: (qIndex: number) => void;
  handleQuestionFieldChange: (qIndex: number, field: keyof Question, value: string) => void;
  addOption: (qIndex: number) => void;
  removeOption: (qIndex: number, optIndex: number) => void;
  removeQuestion: (qIndex: number) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-b-gray-300 pb-2">
        <h3 className="text-xs font-bold text-indigo-700">Q{q.questionNumber}</h3>
        <button
          onClick={() => removeQuestion(qIndex)}
          disabled={questionsLength <= 1}
          className="text-red-500 hover:text-red-700 disabled:opacity-40 cursor-pointer"
          title="Remove question"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Question */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Question</label>
        {q.questionHtml && (
          <div className="border border-gray-200 rounded-md p-2 mb-2 bg-white overflow-auto" data-testid="question-html" dangerouslySetInnerHTML={{ __html: q.questionHtml }} />
        )}
        <textarea
          value={q.question}
          onChange={(e) => handleQuestionChange(qIndex, "question", e.target.value)}
          className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition resize-y"
          rows={3}
          placeholder="Enter question"
        />
      </div>

      {/* Settings Row */}
      <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            {
              icon: <Plus size={13} className="text-green-500" />,
              label: "Marks",
              name: "marks",
              type: "number",
              placeholder: "1",
            },
            {
              icon: <Minus size={13} className="text-red-500" />,
              label: "Neg",
              name: "negativeMarks",
              type: "number",
              placeholder: "0",
            },
            {
              icon: <Scale size={13} className="text-yellow-500" />,
              label: "Grace",
              name: "graceMarks",
              type: "number",
              placeholder: "0",
            },
          ].map((item) => (
            <div key={item.name} className="flex flex-col">
              <label className="flex items-center gap-1 text-[10px] font-medium text-gray-500 mb-0.5">
                {item.icon} {item.label}
              </label>
              <input
                type={item.type}
                min="0"
                value={q[item.name as keyof Question] as string}
                onChange={(e) =>
                  handleQuestionFieldChange(qIndex, item.name as keyof Question, e.target.value)
                }
                className="border border-gray-300 rounded-md px-1 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100"
                placeholder={item.placeholder}
              />
            </div>
          ))}
          <div className="flex flex-col">
            <label className="flex items-center gap-1 text-[10px] font-medium text-gray-500 mb-0.5">
              <Languages size={13} className="text-indigo-500" /> Language
            </label>
            <select
              value={q.language}
              onChange={(e) => handleQuestionFieldChange(qIndex, "language", e.target.value)}
              className="border border-gray-300 rounded-md px-1 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100"
            >
              {languages.length === 0 && <option value="">--</option>}
              {languages.map((l) => (
                <option key={l.language} value={l.language}>
                  {l.language}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Row: Options | Answers | Difficulty/Comments */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Options */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-gray-600">Options</label>
            <button
              type="button"
              onClick={() => addOption(qIndex)}
              className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs hover:bg-indigo-200 cursor-pointer"
            >
              <Plus size={11} /> Add
            </button>
          </div>
          <div className="space-y-1">
            {q.options.map((opt, optIdx) => (
              <div key={optIdx} className="flex flex-col gap-1">
                {q.optionsHtml && q.optionsHtml[optIdx] && (
                  <div
                    className="border border-gray-200 rounded-md p-2 bg-white overflow-auto"
                    data-testid={`option-html-${optIdx}`}
                    dangerouslySetInnerHTML={{ __html: q.optionsHtml[optIdx] as string }}
                  />
                )}
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(qIndex, optIdx, e.target.value)}
                    className="flex-grow border border-gray-300 rounded px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100"
                    placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                  />
                  <button
                    onClick={() => removeOption(qIndex, optIdx)}
                    disabled={q.options.length <= 1}
                    className="text-red-500 hover:text-red-700 disabled:opacity-40 cursor-pointer"
                    title="Remove option"
                  >
                    <MinusCircle size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Answers */}
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Answer(s)</label>
          <div className="flex flex-wrap gap-1">
            {q.options.map((opt, i) => {
              const value = String.fromCharCode(97 + i);
              const isSelected = q.answer.includes(value);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleAnswer(qIndex, value)}
                  className={`px-2 py-0.5 rounded-full border text-xs transition cursor-pointer ${
                    isSelected
                      ? "bg-green-500 text-white border-green-500"
                      : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                  }`}
                  style={{ minWidth: "50px" }}
                >
                  {value}) {opt.trim() ? opt : ""}
                </button>
              );
            })}
          </div>
        </div>

        {/* Difficulty & Comments */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600 mb-0.5">Difficulty</label>
            <select
              value={q.questionDifficultyId || ""}
              onChange={(e) => handleDifficultyChange(qIndex, e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100"
            >
              {difficulties.map((d) => (
                <option key={d.questionDifficultylevelId} value={d.questionDifficultylevelId}>
                  {d.questionDifficultylevel1}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-1 text-xs font-medium text-gray-600">
            <input
              type="checkbox"
              checked={q.allowCandidateComments || false}
              onChange={() => handleAllowCommentsChange(qIndex)}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded cursor-pointer"
            />
            Comments
          </label>
        </div>
      </div>

      {/* Solution */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Solution</label>
        {q.solutionHtml && (
          <div className="border border-gray-200 rounded-md p-2 mb-2 bg-white overflow-auto" data-testid="solution-html" dangerouslySetInnerHTML={{ __html: q.solutionHtml }} />
        )}
        <textarea
          value={q.solution}
          onChange={(e) => handleQuestionChange(qIndex, "solution", e.target.value)}
          className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 resize-y"
          rows={2}
          placeholder="Enter solution"
        />
      </div>
    </div>
  );
}

// ---- Main ----
const Dialog = () => {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [validationErrors, setValidationErrors] = useState<string | null>(null);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [subject, setSubject] = useState<Subject[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [testTypes, setTestTypes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [testdifficulties, setTestDifficulties] = useState<any[]>([]);
  const [instructionsList, setInstructionsList] = useState<any[]>([]);

  // Fetchers ...
  async function fetchTestTypes() {
    try {
      const res = await fetch(
        "https://evalusdevapi.thoughtprotraining.com/api/TestTypes?includeInactive=false&language=English"
      );
      const data = await res.json();
      setTestTypes(data.data);
    } catch (err) {
      setTestTypes([]);
    }
  }
  async function fetchCategories() {
    try {
      const res = await fetch(
        "https://evalusdevapi.thoughtprotraining.com/api/TestCategories?includeInactive=false&language=English"
      );
      const data = await res.json();
      setCategories(data.data);
    } catch (err) {
      setCategories([]);
    }
  }
  async function fetchInstructions() {
    try {
      const res = await fetch(
        "https://evalusdevapi.thoughtprotraining.com/api/TestInstructions?includeInactive=false&language=English"
      );
      const data = await res.json();
      setInstructionsList(data.data);
    } catch (err) {
      setInstructionsList([]);
    }
  }
  async function fetchTestDifficulties() {
    try {
      const res = await fetch(
        "https://evalusdevapi.thoughtprotraining.com/api/TestDifficultyLevels?includeInactive=false"
      );
      const data = await res.json();
      setTestDifficulties(data.data || []);
    } catch (err) {
      setTestDifficulties([]);
    }
  }
  async function fetchDifficulties() {
    try {
      const res = await fetch(
        "https://evalusdevapi.thoughtprotraining.com/api/QuestionDifficultyLevels?includeInactive=false"
      );
      const data = await res.json();
      const list = data.data || [];
      setDifficulties(list);

      if (list.length > 0) {
        setQuestions((prev) =>
          prev.map((q) => ({
            ...q,
            questionDifficultyId: q.questionDifficultyId ?? list[0].questionDifficultylevelId,
          }))
        );
      }
    } catch {
      setDifficulties([]);
    }
  }
  async function fetchSubjects() {
    try {
      const res = await fetch(
        "https://evalusdevapi.thoughtprotraining.com/api/Subjects?includeInactive=false"
      );
      const data = await res.json();
      setSubject(data.data || []);
    } catch {
      setSubject([]);
    }
  }
  async function fetchLanguages() {
    try {
      const res = await fetch("https://evalusdevapi.thoughtprotraining.com/api/Languages");
      const data = await res.json();
      setLanguages(data.data || []);
      // Default to first language (if any)
      if (data.data && data.data.length && questions.length === 0) {
        // Set default language for future questions
      }
    } catch {
      setLanguages([]);
    }
  }

  useEffect(() => {
    fetchDifficulties();
    fetchSubjects();
    fetchLanguages();
    fetchTestTypes();
    fetchCategories();
    fetchInstructions();
    fetchTestDifficulties();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    Office.onReady(() => {
      Office.context.ui.messageParent("dialogReady");
      Office.context.ui.addHandlerAsync(Office.EventType.DialogParentMessageReceived, (arg) => {
        (async () => {
          try {
            const received = JSON.parse(arg.message);
            const formData: FormData = JSON.parse(received.form);
            let qs: Question[] = JSON.parse(received.questions);
            // Normalize and default fields
            if (difficulties.length > 0 || languages.length > 0) {
              qs = qs.map((q) => ({
                ...q,
                questionDifficultyId:
                  q.questionDifficultyId ?? difficulties[0]?.questionDifficultylevelId,
                allowCandidateComments: q.allowCandidateComments ?? false,
                marks: q.marks ?? "1",
                negativeMarks: q.negativeMarks ?? "0",
                graceMarks: q.graceMarks ?? "0",
                language: q.language ?? languages[0]?.language ?? "",
              }));
            }
            // Sanitize and inline images in HTML fields
            qs = await inlineAllQuestionHtml(qs);
            setFormData(formData);
            setQuestions(qs);
            setValidationErrors(null);
          } catch {
            setFormData(null);
            setQuestions([]);
            setValidationErrors(null);
          }
        })();
      });
    });
  }, [difficulties, languages]);

  // Handlers ...
  const handleAllowCommentsChange = (qIndex: number) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      newQs[qIndex].allowCandidateComments = !newQs[qIndex].allowCandidateComments;
      return newQs;
    });
  };
  const handleQuestionChange = (index: number, field: "question" | "solution", value: string) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      newQs[index] = { ...newQs[index], [field]: value };
      return newQs;
    });
  };
  const handleOptionChange = (qIndex: number, optIndex: number, value: string) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      const newOptions = [...newQs[qIndex].options];
      newOptions[optIndex] = value;
      newQs[qIndex] = { ...newQs[qIndex], options: newOptions };
      return newQs;
    });
  };
  const toggleAnswer = (qIndex: number, optionValue: string) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      const currentAnswers = new Set(newQs[qIndex].answer);
      if (currentAnswers.has(optionValue)) {
        currentAnswers.delete(optionValue);
      } else {
        currentAnswers.add(optionValue);
      }
      newQs[qIndex].answer = Array.from(currentAnswers);
      return newQs;
    });
  };
  const handleDifficultyChange = (qIndex: number, value: string) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      newQs[qIndex].questionDifficultyId = Number(value);
      return newQs;
    });
  };
  const handleQuestionFieldChange = (qIndex: number, field: keyof Question, value: string) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      newQs[qIndex] = { ...newQs[qIndex], [field]: value };
      return newQs;
    });
  };
  const addOption = (qIndex: number) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      newQs[qIndex].options.push("");
      return newQs;
    });
  };
  const removeOption = (qIndex: number, optIndex: number) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      if (newQs[qIndex].options.length > 1) {
        newQs[qIndex].options.splice(optIndex, 1);
      }
      return newQs;
    });
  };
  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        questionNumber: prev.length + 1,
        question: "",
        options: [""],
        answer: [],
        solution: "",
        questionDifficultyId:
          difficulties.length > 0 ? difficulties[0].questionDifficultylevelId : undefined,
        allowCandidateComments: false,
        marks: "1",
        negativeMarks: "0",
        graceMarks: "0",
        language: languages.length > 0 ? languages[0].language : "",
      },
    ]);
  };
  const removeQuestion = (index: number) => {
    setQuestions((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, questionNumber: i + 1 }));
    });
  };

  const validateAll = (): string | null => {
    if (!formData) return "Form data is missing.";
    if (questions.length === 0) return "At least one question is required.";
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.question.trim() === "") return `Q${q.questionNumber}: Question cannot be empty.`;
      if (q.options.length === 0) return `Q${q.questionNumber}: Must have at least one option.`;
      if (q.options.some((opt) => opt.trim() === ""))
        return `Q${q.questionNumber}: An option is empty.`;
      if (q.answer.length === 0) return `Q${q.questionNumber}: Please select at least one answer.`;
      if (!q.questionDifficultyId) return `Q${q.questionNumber}: Select a difficulty.`;
      if (!q.marks) return `Q${q.questionNumber}: Marks are required.`;
      if (!q.negativeMarks) return `Q${q.questionNumber}: Negative marks are required.`;
      if (!q.graceMarks) return `Q${q.questionNumber}: Grace marks are required.`;
      if (!q.language) return `Q${q.questionNumber}: Language is required.`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validateAll();
    setValidationErrors(error);
    const payload = {
      testMetaData: formData,
      questions: questions.map((q, i) => ({
        questionNumber: i + 1,
        question: q.question,
        options: q.options,
        answer: q.answer,
        solution: q.solution,
        marks: Number(q.marks),
        negativeMarks: Number(q.negativeMarks),
        graceMarks: Number(q.graceMarks),
        language: q.language,
        questionDifficultyLevelId: q.questionDifficultyId,
        sectionId: 2,
        allowCandidateComments: q.allowCandidateComments,
        questionTypeId: 1,
        subjectId: 6,
      })),
    };
    if (!error) {
      try {
        const res = await fetch(
          "https://evalusdevapi.thoughtprotraining.com/api/Tests/create-with-questions",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.errorMessage);
        }
        const data = await res.json();
        console.log("Test created successfully:", data);
        Office.context.ui.messageParent("closeDialog");
      } catch (err) {
        console.error("Failed to create test:", err);
      }
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md w-full min-h-screen overflow-auto font-sans text-sm">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 border-b pb-2 border-gray-200">
        <h1 className="text-xl font-semibold text-indigo-700 flex items-center gap-2">
          Test Preview
        </h1>
        <button
          onClick={handleSubmit}
          className="flex items-center gap-1 px-6 py-1 bg-indigo-600 text-white rounded border border-indigo-600 hover:bg-indigo-700 transition text-sm cursor-pointer"
        >
          <CheckCircle2 size={14} /> Save Test
        </button>
      </div>

      {/* Test Details */}
      {formData && (
        <TestDetails
          formData={formData}
          testTypes={testTypes}
          categories={categories}
          instructionsList={instructionsList}
          testdifficulties={testdifficulties}
        />
      )}

      {/* Validation Error */}
      {validationErrors && (
        <div className="mb-3 p-2 bg-red-50 text-red-700 rounded flex items-center gap-1 border border-red-200 text-xs">
          <AlertTriangle size={14} /> {validationErrors}
        </div>
      )}

      {!formData ? (
        <p className="text-gray-500 text-center italic text-sm">Waiting for test data...</p>
      ) : (
        <>
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
              <ListChecks size={16} className="text-indigo-500" />
              Questions
            </h2>
            <button
              onClick={addQuestion}
              className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded shadow-sm hover:bg-green-600 transition text-xs cursor-pointer"
              title="Add New Question"
            >
              <Plus size={14} /> Add Question
            </button>
          </div>

          {/* Question Cards List */}
          <div className="space-y-4">
            {questions.map((q, qIndex) => (
              <QuestionCard
                key={q.questionNumber}
                q={q}
                qIndex={qIndex}
                questionsLength={questions.length}
                difficulties={difficulties}
                languages={languages}
                handleQuestionChange={handleQuestionChange}
                handleOptionChange={handleOptionChange}
                toggleAnswer={toggleAnswer}
                handleDifficultyChange={handleDifficultyChange}
                handleAllowCommentsChange={handleAllowCommentsChange}
                handleQuestionFieldChange={handleQuestionFieldChange}
                addOption={addOption}
                removeOption={removeOption}
                removeQuestion={removeQuestion}
              />
            ))}
          </div>
        </>
      )}

      <Toaster />
    </div>
  );
};

export default Dialog;

// ---- HTML helpers: sanitize and inline images as data URLs ----
async function inlineAllQuestionHtml(qs: Question[]): Promise<Question[]> {
  const result: Question[] = [];
  for (const q of qs) {
    const questionHtml = q.questionHtml ? await sanitizeAndInlineImages(q.questionHtml) : q.questionHtml;
    const optionsHtml = q.optionsHtml
      ? await Promise.all(q.optionsHtml.map((h) => sanitizeAndInlineImages(h)))
      : q.optionsHtml;
    const answerHtml = q.answerHtml ? await sanitizeAndInlineImages(q.answerHtml) : q.answerHtml;
    const solutionHtml = q.solutionHtml
      ? await sanitizeAndInlineImages(q.solutionHtml)
      : q.solutionHtml;
    result.push({ ...q, questionHtml, optionsHtml, answerHtml, solutionHtml });
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
