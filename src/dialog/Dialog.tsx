import React, { useEffect, useState } from "react";

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
  difficulty: string;
  secondaryTestType: string;
}

interface Question {
  questionNumber: number;
  question: string;
  options: string[];
  answer: string[];
  solution: string;
  questionDifficultyId?: number; // added here
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

const Dialog = () => {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [validationErrors, setValidationErrors] = useState<string | null>(null);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [subject, setSubject] = useState<Subject[]>([]);

  async function fetchDifficulties() {
    try {
      const res = await fetch(
        "https://evalusdevapi.thoughtprotraining.com/api/QuestionDifficultyLevels?includeInactive=false"
      );
      const data = await res.json();
      const list = data.data || [];
      setDifficulties(list);

      // If we have questions already fetched, set default difficulty if missing
      if (list.length > 0) {
        setQuestions((prev) =>
          prev.map((q) => ({
            ...q,
            questionDifficultyId: q.questionDifficultyId ?? list[0].questionDifficultylevelId,
          }))
        );
      }
    } catch (err) {
      setDifficulties([]);
    }
  }

  async function fetchSubjects() {
    try {
      const res = await fetch(
        "https://evalusdevapi.thoughtprotraining.com/api/Subjects?includeInactive=false"
      );
      const data = await res.json();
      setSubject(data || []);
    } catch (err) {
      setDifficulties([]);
    }
  }

  useEffect(() => {
    fetchDifficulties();
    fetchSubjects();
  }, []);

  useEffect(() => {
    Office.onReady(() => {
      Office.context.ui.messageParent("dialogReady");

      Office.context.ui.addHandlerAsync(Office.EventType.DialogParentMessageReceived, (arg) => {
        try {
          const received = JSON.parse(arg.message);
          const formData: FormData = JSON.parse(received.form);
          let qs: Question[] = JSON.parse(received.questions);

          // Add default difficulty to all questions if available
          if (difficulties.length > 0) {
            qs = qs.map((q) => ({
              ...q,
              questionDifficultyId:
                q.questionDifficultyId ?? difficulties[0].questionDifficultylevelId,
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

  // Validation function updated to handle question count >= 1
  const validateAll = (): string | null => {
    if (!formData) return "Form data is missing.";

    if (questions.length === 0) return "At least one question is required.";

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      if (q.question.trim() === "") {
        return `Question ${q.questionNumber}: Question text cannot be empty.`;
      }
      if (q.options.length === 0) {
        return `Question ${q.questionNumber}: Must have at least one option.`;
      }
      if (q.options.some((opt) => opt.trim() === "")) {
        return `Question ${q.questionNumber}: All options must be non-empty.`;
      }
      if (q.answer.length === 0) {
        return `Question ${q.questionNumber}: Please select at least one answer.`;
      }
      if (!q.questionDifficultyId) {
        return `Question ${q.questionNumber}: Please select a difficulty.`;
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    const error = validateAll();
    setValidationErrors(error);

    const payload = {
      testMetaData: formData,
      questions: questions.map((q) => ({
        question: q.question,
        options: q.options,
        answer: q.answer,
        solution: q.solution,
        // questionTypeId: someValue,
        // subjectId: someValue,
        // marks: someValue,
        // negativeMarks: someValue,
        // graceMarks: someValue,
        questionDifficultyLevelId: q.questionDifficultyId,
        // sectionId: someValue,
        // language: someValue,
        // allowCandidateComments: someValue
      })),
    };

    if (!error) {
      console.log("Submitted data:", payload);
      try {
        const res = await fetch(
          "https://evalusdevapi.thoughtprotraining.com/api/Tests/create-with-questions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        if (!res.ok) {
          // Handle non-2xx responses
          const errText = await res.text();
          throw new Error(`HTTP ${res.status} - ${errText}`);
        }

        const data = await res.json();
        console.log("Test created successfully:", data);
        // You could show success UI / close dialog here
      } catch (err) {
        console.error("Failed to create test:", err);
        // Show error notification / UI
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

  const handleAnswerChange = (qIndex: number, selectedOptions: string[]) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      newQs[qIndex] = { ...newQs[qIndex], answer: selectedOptions };
      return newQs;
    });
  };

  const handleDifficultyChange = (qIndex: number, value: string) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      newQs[qIndex] = {
        ...newQs[qIndex],
        questionDifficultyId: Number(value),
      };
      return newQs;
    });
  };

  const addOption = (qIndex: number) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      newQs[qIndex] = { ...newQs[qIndex], options: [...newQs[qIndex].options, ""] };
      return newQs;
    });
  };

  const removeOption = (qIndex: number, optIndex: number) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      const opts = [...newQs[qIndex].options];
      if (opts.length <= 1) return newQs;
      opts.splice(optIndex, 1);
      newQs[qIndex] = { ...newQs[qIndex], options: opts };
      return newQs;
    });
  };

  const addQuestion = () => {
    setQuestions((prev) => {
      const newNum = prev.length ? prev[prev.length - 1].questionNumber + 1 : 1;
      return [
        ...prev,
        {
          questionNumber: newNum,
          question: "",
          options: [""],
          answer: [],
          solution: "",
          questionDifficultyId:
            difficulties.length > 0 ? difficulties[0].questionDifficultylevelId : undefined,
        },
      ];
    });
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((q, i) => ({ ...q, questionNumber: i + 1 }));
    });
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg w-full h-screen mx-auto font-sans">
      <div className="flex justify-between items-center mb-4 border-b border-b-indigo-200">
        <h1 className="text-3xl font-bold text-indigo-700 pb-2">Test Preview</h1>
        <button
          onClick={handleSubmit}
          className="px-6 py-1 font-bold bg-indigo-600 text-white rounded-md shadow hover:bg-indigo-700"
        >
          Submit
        </button>
      </div>

      {validationErrors && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{validationErrors}</div>
      )}

      {!formData ? (
        <p className="text-gray-500 text-center">Waiting for test data...</p>
      ) : (
        <>
          {/* Table */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-indigo-600 border-b border-indigo-200 pb-1">
                Extracted Questions
              </h2>
              <button
                type="button"
                onClick={addQuestion}
                className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded text-sm hover:bg-indigo-200"
              >
                + Add Question
              </button>
            </div>

            <div className="overflow-auto max-h-[400px] rounded-md shadow-md border border-gray-300">
              <table className="min-w-full divide-y divide-gray-300 table-auto">
                <thead className="bg-indigo-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-3">Q#</th>
                    <th className="px-5 py-3">Question</th>
                    <th className="px-5 py-3">Options</th>
                    <th className="px-5 py-3">Answer(s)</th>
                    <th className="px-5 py-3">Difficulty</th>
                    <th className="px-5 py-3">Solution</th>
                    <th className="px-5 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, qIndex) => (
                    <tr key={q.questionNumber} className="even:bg-indigo-50 align-top">
                      <td className="px-5 py-3">{q.questionNumber}</td>
                      <td className="px-5 py-3">
                        <textarea
                          value={q.question}
                          onChange={(e) => handleQuestionChange(qIndex, "question", e.target.value)}
                          className="w-full border rounded p-1"
                        />
                      </td>
                      <td className="px-5 py-3 space-y-1">
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex gap-2">
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => handleOptionChange(qIndex, optIdx, e.target.value)}
                              className="flex-grow border rounded p-1 text-sm"
                            />
                            <button
                              onClick={() => removeOption(qIndex, optIdx)}
                              type="button"
                              disabled={q.options.length <= 1}
                              className="text-red-600 font-bold"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addOption(qIndex)}
                          className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-sm"
                        >
                          + Option
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <select
                          multiple
                          value={q.answer}
                          onChange={(e) => {
                            const selected = Array.from(
                              e.target.selectedOptions,
                              (option) => option.value
                            );
                            handleAnswerChange(qIndex, selected);
                          }}
                          className="w-full border rounded p-1 text-sm"
                          size={Math.min(q.options.length, 5)}
                        >
                          {q.options.map((opt, i) => (
                            <option key={i} value={String.fromCharCode(97 + i)}>
                              {String.fromCharCode(97 + i)}) {opt}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        <select
                          value={q.questionDifficultyId || ""}
                          onChange={(e) => handleDifficultyChange(qIndex, e.target.value)}
                          className="w-full border rounded p-1 text-sm"
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
                      <td className="px-5 py-3">
                        <textarea
                          value={q.solution}
                          onChange={(e) => handleQuestionChange(qIndex, "solution", e.target.value)}
                          className="w-full border rounded p-1 text-sm"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => removeQuestion(qIndex)}
                          disabled={questions.length <= 1}
                          className="text-red-600 border border-red-600 rounded px-2 py-1 text-sm"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Dialog;
