import React, { useEffect, useState } from "react";
import { Plus, MinusCircle, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
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
        subjectId: 2
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

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg w-full min-h-screen h-fit overflow-auto font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b pb-3 border-gray-200">
        <h1 className="text-2xl font-bold text-indigo-700 flex items-center gap-2">Test Preview</h1>
        <button
          onClick={handleSubmit}
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition"
        >
          <CheckCircle2 size={18} /> Submit
        </button>
      </div>

      {formData && (
        <section className="mb-6 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Test Details</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {[
              {
                key: "testName",
                label: "Test Name",
                value: formData.testName,
              },
              {
                key: "testType",
                label: "Test Type",
                value: testTypes.find((t) => String(t.testTypeId) === String(formData.testType))
                  ?.testType1,
              },
              {
                key: "testCode",
                label: "Test Code",
                value: formData.testCode,
              },
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
              {
                key: "duration",
                label: "Duration",
                value: formData.duration,
              },
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
              {
                key: "totalMarks",
                label: "Total Marks",
                value: formData.totalMarks,
              },
              {
                key: "difficulty",
                label: "Difficulty",
                value: testdifficulties.find(
                  (d) => String(d.testDifficultyLevelId) === String(formData.testDifficultyLevel1)
                )?.testDifficultyLevel1,
              },
            ].map(({ key, label, value }) => (
              <div key={key}>
                <div className="text-xs text-gray-500 font-semibold">{label}</div>
                {key === "instructions" ? (
                  <div className="mt-1 text-sm text-gray-700 bg-white rounded-sm border border-gray-200 p-2 max-h-16 overflow-auto whitespace-pre-wrap">
                    {value || <span className="italic text-gray-400">No instructions</span>}
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-gray-800 bg-white rounded-sm border border-gray-200 px-2 py-1 truncate">
                    {value || <span className="italic text-gray-400">-</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Question Defaults */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3 mb-6 px-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
          <input
            type="number"
            min="0"
            name="marks"
            value={questionDefaults.marks}
            onChange={handleDefaultsChange}
            className="w-28 border rounded p-2 focus:ring focus:ring-indigo-200"
            placeholder="e.g. 1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Negative Marks</label>
          <input
            type="number"
            name="negativeMarks"
            value={questionDefaults.negativeMarks}
            onChange={handleDefaultsChange}
            className="w-28 border rounded p-2 focus:ring focus:ring-indigo-200"
            placeholder="e.g. 0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Grace Marks</label>
          <input
            type="number"
            name="graceMarks"
            value={questionDefaults.graceMarks}
            onChange={handleDefaultsChange}
            className="w-28 border rounded p-2 focus:ring focus:ring-indigo-200"
            placeholder="e.g. 0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
          <select
            name="language"
            value={questionDefaults.language}
            onChange={handleDefaultsChange}
            className="w-40 border rounded p-2 focus:ring focus:ring-indigo-200"
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

      {/* Validation Error */}
      {validationErrors && (
        <div className="mb-5 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 border border-red-200">
          <AlertTriangle size={18} />
          {validationErrors}
        </div>
      )}

      {!formData ? (
        <p className="text-gray-500 text-center italic">Waiting for test data...</p>
      ) : (
        <>
          {/* Question table */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-indigo-700">Extracted Questions</h2>
            <button
              type="button"
              onClick={addQuestion}
              className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition"
            >
              <Plus size={16} /> Add Question
            </button>
          </div>

          <div className="overflow-auto max-h-[65vh] rounded-lg shadow border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-indigo-50 sticky top-0">
                <tr className="text-left">
                  <th className="px-4 py-3">Q#</th>
                  <th className="px-4 py-3">Question</th>
                  <th className="px-4 py-3">Options</th>
                  <th className="px-4 py-3">Answer(s)</th>
                  <th className="px-4 py-3">Difficulty</th>
                  <th className="px-4 py-3">Solution</th>
                  <th className="px-4 py-3">Allow Comments</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q, qIndex) => (
                  <tr key={q.questionNumber} className="odd:bg-white even:bg-indigo-50/30">
                    <td className="px-4 py-3">{q.questionNumber}</td>
                    <td className="px-4 py-3">
                      <textarea
                        value={q.question}
                        onChange={(e) => handleQuestionChange(qIndex, "question", e.target.value)}
                        className="w-full border rounded p-2 focus:ring focus:ring-indigo-200"
                      />
                    </td>
                    <td className="px-4 py-3 space-y-2">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => handleOptionChange(qIndex, optIdx, e.target.value)}
                            className="flex-grow border rounded p-2 text-sm"
                          />
                          <button
                            onClick={() => removeOption(qIndex, optIdx)}
                            disabled={q.options.length <= 1}
                            className="text-red-500 hover:text-red-700 disabled:opacity-50"
                          >
                            <MinusCircle size={18} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(qIndex)}
                        className="flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs hover:bg-indigo-200"
                      >
                        <Plus size={14} /> Option
                      </button>
                    </td>
                    {/* Answer(s) column as chips */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        {q.options.map((opt, i) => {
                          const value = String.fromCharCode(97 + i);
                          const isSelected = q.answer.includes(value);
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => toggleAnswer(qIndex, value)}
                              className={`w-fit flex items-center gap-1 px-2 py-1 rounded-full border cursor-pointer font-semibold ${
                                isSelected
                                  ? "bg-green-500 text-white border-green-500"
                                  : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                              } text-xs`}
                            >
                              {value}) {opt || "Option"}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={q.questionDifficultyId || ""}
                        onChange={(e) => handleDifficultyChange(qIndex, e.target.value)}
                        className="w-full border rounded p-2 text-sm"
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
                    <td className="px-4 py-3">
                      <textarea
                        value={q.solution}
                        onChange={(e) => handleQuestionChange(qIndex, "solution", e.target.value)}
                        className="w-full border rounded p-2 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={q.allowCandidateComments || false}
                        onChange={() => handleAllowCommentsChange(qIndex)}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                      />
                    </td>

                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => removeQuestion(qIndex)}
                        disabled={questions.length <= 1}
                        className="cursor-pointer text-red-500 hover:text-red-600"
                      >
                        <Trash2 size={16} />
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
