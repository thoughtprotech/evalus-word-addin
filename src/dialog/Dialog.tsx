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
  questionDifficultyId?: number;
  allowCandidateComments?: boolean;
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

const Dialog = () => {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [validationErrors, setValidationErrors] = useState<string | null>(null);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [subject, setSubject] = useState<Subject[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);

  const [testTypes, setTestTypes] = useState<
    {
      testTypeId: number;
      testType1: string;
      language: string;
      isActive: number;
      createdBy: string;
      createdDate: string;
      modifiedBy: string;
      modifiedDate: string;
    }[]
  >([]);
  const [categories, setCategories] = useState<
    {
      testCategoryId: number;
      testCategoryName: string;
      testCategoryType: string;
      parentId: number;
      language: string;
      isActive: number;
      createdBy: string;
      createdDate: string;
      modifiedBy: string;
      modifiedDate: string;
    }[]
  >([]);
  const [testdifficulties, setTestDifficulties] = useState<
    {
      testDifficultyLevelId: number;
      testDifficultyLevel1: string;
    }[]
  >([]);
  const [instructionsList, setInstructionsList] = useState<
    {
      testInstructionId: number;
      testInstructionName: string;
      testInstruction1: string;
      language: string;
      isActive: number;
      createdBy: string;
      createdDate: string;
      modifiedBy: string;
      modifiedDate: string;
    }[]
  >([]);

  // New defaults state for all questions
  const [questionDefaults, setQuestionDefaults] = useState({
    marks: "",
    negativeMarks: "",
    graceMarks: "",
    language: "",
  });

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
      console.log({ data: data.data });
      setLanguages(data.data || []);
      // Default to first language (if any)
      if (data.data && data.data.length && !questionDefaults.language) {
        setQuestionDefaults((prev) => ({ ...prev, language: data.data[0].language }));
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
        try {
          const received = JSON.parse(arg.message);
          const formData: FormData = JSON.parse(received.form);
          let qs: Question[] = JSON.parse(received.questions);
          if (difficulties.length > 0) {
            qs = qs.map((q) => ({
              ...q,
              questionDifficultyId:
                q.questionDifficultyId ?? difficulties[0].questionDifficultylevelId,
              allowCandidateComments: q.allowCandidateComments ?? false,
            }));
          }
          setFormData(formData);
          setQuestions(qs);
          setValidationErrors(null);
        } catch {
          setFormData(null);
          setQuestions([]);
          setValidationErrors(null);
        }
      });
    });
  }, [difficulties]);

  const handleAllowCommentsChange = (qIndex: number) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      newQs[qIndex].allowCandidateComments = !newQs[qIndex].allowCandidateComments;
      return newQs;
    });
  };

  const validateAll = (): string | null => {
    if (!formData) return "Form data is missing.";
    if (questions.length === 0) return "At least one question is required.";
    if (!questionDefaults.marks) return "Default marks must be set.";
    if (!questionDefaults.negativeMarks) return "Default negative marks must be set.";
    if (!questionDefaults.graceMarks) return "Default grace marks must be set.";
    if (!questionDefaults.language) return "Default language must be selected.";

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.question.trim() === "") return `Q${q.questionNumber}: Question cannot be empty.`;
      if (q.options.length === 0) return `Q${q.questionNumber}: Must have at least one option.`;
      if (q.options.some((opt) => opt.trim() === ""))
        return `Q${q.questionNumber}: An option is empty.`;
      if (q.answer.length === 0) return `Q${q.questionNumber}: Please select at least one answer.`;
      if (!q.questionDifficultyId) return `Q${q.questionNumber}: Select a difficulty.`;
    }

    return null;
  };

  const handleSubmit = async () => {
    const error = validateAll();
    setValidationErrors(error);

    const { marks, negativeMarks, graceMarks, language } = questionDefaults;

    const payload = {
      testMetaData: formData,
      questions: questions.map((q, i) => ({
        questionNumber: i + 1,
        question: q.question,
        options: q.options,
        answer: q.answer,
        solution: q.solution,
        marks: Number(marks),
        negativeMarks: Number(negativeMarks),
        graceMarks: Number(graceMarks),
        language,
        questionDifficultyLevelId: q.questionDifficultyId,
        sectionId: 2,
        allowCandidateComments: q.allowCandidateComments,
        questionTypeId: 1,
        subjectId: 6,
      })),
    };

    if (!error) {
      try {
        console.log({ payload });
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

          // console.log({ res });
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
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, questionNumber: i + 1 }));
    });
  };

  // Handle default input changes
  const handleDefaultsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setQuestionDefaults((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const detailIcons = {
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

  return (
    <div className="p-4 bg-white rounded-lg shadow-md w-full min-h-screen overflow-auto font-sans text-sm">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 border-b pb-2 border-gray-200">
        <h1 className="text-xl font-semibold text-indigo-700 flex items-center gap-2">
          Test Preview
        </h1>
        <button
          onClick={handleSubmit}
          className="flex items-center gap-1 px-4 py-1.5 bg-indigo-600 text-white rounded border border-indigo-600 hover:bg-indigo-700 transition text-sm"
        >
          <CheckCircle2 size={16} /> Submit
        </button>
      </div>

      {/* Test Details */}
      {formData && (
        <section className="mb-4 bg-white/70 rounded-lg border border-gray-100 shadow-sm">
          {/* Header */}
          <h2 className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-gray-50 text-sm font-semibold text-indigo-700">
            <Info size={18} className="text-indigo-500" />
            Test Details
          </h2>

          {/* Grid layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 p-4">
            {[
              { key: "testName", label: "Test Name", value: formData.testName },
              {
                key: "testType",
                label: "Test Type",
                value: testTypes.find((t) => String(t.testTypeId) === String(formData.testType))
                  ?.testType1,
              },
              { key: "testCode", label: "Test Code", value: formData.testCode },
              {
                key: "category",
                label: "Category",
                value: categories.find(
                  (c) => String(c.testCategoryId) === String(formData.category)
                )?.testCategoryName,
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
            ].map(({ key, label, value }) => (
              <div
                key={key}
                className="flex items-start gap-3 bg-white rounded-md border border-gray-100 p-2 hover:shadow-sm transition"
              >
                {/* Icon */}
                <div className="flex-shrink-0 w-5 h-5 mt-0.5 text-indigo-500">
                  {detailIcons[key] || null}
                </div>

                {/* Label + Value */}
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
      )}

      {/* Question Defaults */}
      <div className="mb-5 bg-white rounded-lg border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-indigo-700 mb-3 flex items-center gap-2">
          <Scale size={16} className="text-indigo-500" />
          Question Defaults
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: <Plus size={14} className="text-green-500" />,
              label: "Marks",
              name: "marks",
              type: "number",
              placeholder: "1",
            },
            {
              icon: <Minus size={14} className="text-red-500" />,
              label: "Negative Marks",
              name: "negativeMarks",
              type: "number",
              placeholder: "0",
            },
            {
              icon: <Scale size={14} className="text-yellow-500" />,
              label: "Grace Marks",
              name: "graceMarks",
              type: "number",
              placeholder: "0",
            },
          ].map((item) => (
            <div key={item.name} className="flex flex-col">
              <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                {item.icon}
                {item.label}
              </label>
              <input
                type={item.type}
                name={item.name}
                min="0"
                value={questionDefaults[item.name as keyof typeof questionDefaults]}
                onChange={handleDefaultsChange}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition"
                placeholder={item.placeholder}
              />
            </div>
          ))}

          {/* Language select */}
          <div className="flex flex-col">
            <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
              <Languages size={14} className="text-indigo-500" />
              Language
            </label>
            <select
              name="language"
              value={questionDefaults.language}
              onChange={handleDefaultsChange}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition"
            >
              {languages.length === 0 && <option value="">--No Languages--</option>}
              {languages.map((l) => (
                <option key={l.language} value={l.language}>
                  {l.language}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

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
              className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded shadow-sm hover:bg-green-600 transition text-xs"
              title="Add New Question"
            >
              <Plus size={14} /> Add Question
            </button>
          </div>

          {/* Table */}
          <div className="overflow-auto max-h-[65vh] rounded-lg border border-gray-200 shadow-sm">
            <table className="min-w-full text-xs">
              <thead className="bg-indigo-50 sticky top-0 shadow-sm">
                <tr className="text-left text-indigo-700">
                  {[
                    { label: "Q#", icon: <List size={12} /> },
                    { label: "Question", icon: <AlignLeft size={12} /> },
                    { label: "Options", icon: <List size={12} /> },
                    { label: "Answer(s)", icon: <ListChecks size={12} /> },
                    { label: "Difficulty", icon: <Target size={12} /> },
                    { label: "Solution", icon: <Lightbulb size={12} /> },
                    { label: "Comments", icon: <MessageSquare size={12} /> },
                    { label: "Action", icon: <Settings2 size={12} /> },
                  ].map(({ label, icon }) => (
                    <th key={label} className="px-3 py-2 font-semibold">
                      <div className="flex items-center gap-1">
                        {icon}
                        {label}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {questions.map((q, qIndex) => (
                  <tr
                    key={q.questionNumber}
                    className="odd:bg-white even:bg-indigo-50/40 hover:bg-indigo-100/40 transition"
                  >
                    {/* Q# */}
                    <td className="px-3 py-2 font-medium text-gray-600">{q.questionNumber}</td>

                    {/* Question */}
                    <td className="px-3 py-2 w-[200px]">
                      <textarea
                        value={q.question}
                        onChange={(e) => handleQuestionChange(qIndex, "question", e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300 resize-y"
                        rows={2}
                        placeholder="Enter question"
                      />
                    </td>

                    {/* Options */}
                    <td className="px-3 py-2 space-y-1 min-w-[180px]">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex gap-1 items-center">
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => handleOptionChange(qIndex, optIdx, e.target.value)}
                            className="flex-grow border border-gray-300 rounded px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300"
                            placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                          />
                          <button
                            onClick={() => removeOption(qIndex, optIdx)}
                            disabled={q.options.length <= 1}
                            className="text-red-500 hover:text-red-700 disabled:opacity-40"
                            title="Remove option"
                          >
                            <MinusCircle size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(qIndex)}
                        className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] hover:bg-indigo-200 transition"
                        title="Add option"
                      >
                        <Plus size={12} /> Option
                      </button>
                    </td>

                    {/* Answer(s) */}
                    <td className="px-3 py-2 min-w-[140px]">
                      <div className="flex flex-col gap-1">
                        {q.options.map((opt, i) => {
                          const value = String.fromCharCode(97 + i);
                          const isSelected = q.answer.includes(value);
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => toggleAnswer(qIndex, value)}
                              className={`px-2 py-0.5 rounded-full border text-[10px] transition ${
                                isSelected
                                  ? "bg-green-500 text-white border-green-500"
                                  : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                              }`}
                              title={isSelected ? "Click to unselect" : "Click to select"}
                            >
                              {value}) {opt || "Option"}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    {/* Difficulty */}
                    <td className="px-3 py-2 min-w-[120px]">
                      <select
                        value={q.questionDifficultyId || ""}
                        onChange={(e) => handleDifficultyChange(qIndex, e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300"
                        title="Select difficulty level"
                      >
                        {difficulties.map((d) => (
                          <option
                            key={d.questionDifficultylevelId}
                            value={d.questionDifficultylevelId}
                          >
                            {d.questionDifficultylevel1}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Solution */}
                    <td className="px-3 py-2 min-w-[160px]">
                      <textarea
                        value={q.solution}
                        onChange={(e) => handleQuestionChange(qIndex, "solution", e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300 resize-y"
                        rows={2}
                        placeholder="Enter solution"
                      />
                    </td>

                    {/* Comments */}
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={q.allowCandidateComments || false}
                        onChange={() => handleAllowCommentsChange(qIndex)}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded cursor-pointer"
                        title="Allow comments"
                      />
                    </td>

                    {/* Action */}
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => removeQuestion(qIndex)}
                        disabled={questions.length <= 1}
                        className="text-red-500 hover:text-red-700 disabled:opacity-40"
                        title="Remove question"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Toaster />
    </div>
  );
};

export default Dialog;
