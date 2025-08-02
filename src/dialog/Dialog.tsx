// Dialog.tsx
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
}

const Dialog = () => {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [validationErrors, setValidationErrors] = useState<string | null>(null);

  useEffect(() => {
    Office.onReady(() => {
      Office.context.ui.messageParent("dialogReady");

      Office.context.ui.addHandlerAsync(Office.EventType.DialogParentMessageReceived, (arg) => {
        try {
          const received = JSON.parse(arg.message);
          const formData: FormData = JSON.parse(received.form);
          const questions: Question[] = JSON.parse(received.questions);
          setFormData(formData);
          setQuestions(questions);
          setValidationErrors(null);
        } catch {
          setFormData(null);
          setQuestions([]);
          setValidationErrors(null);
        }
      });
    });
  }, []);

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
      for (const ans of q.answer) {
        const idx = ans.charCodeAt(0) - 97;
        if (idx < 0 || idx >= q.options.length) {
          return `Question ${q.questionNumber}: Invalid answer character "${ans}".`;
        }
      }
    }

    return null;
  };

  const handleSubmit = () => {
    const error = validateAll();
    setValidationErrors(error);

    if (!error) {
      console.log("Submitted data:", { formData, questions });
      // Further submission logic here
    }
  };

  // Update a question field (question or solution)
  const handleQuestionChange = (index: number, field: "question" | "solution", value: string) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      newQs[index] = { ...newQs[index], [field]: value };
      return newQs;
    });
  };

  // Add a new option to the question
  const addOption = (qIndex: number) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      const newOptions = [...newQs[qIndex].options, ""]; // add empty option
      newQs[qIndex] = { ...newQs[qIndex], options: newOptions };
      return newQs;
    });
  };

  // Remove an option by index from question
  const removeOption = (qIndex: number, optIndex: number) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      const oldOptions = [...newQs[qIndex].options];
      if (oldOptions.length <= 1) return newQs; // Don't remove last option
      oldOptions.splice(optIndex, 1);
      let newAnswers = newQs[qIndex].answer.filter((ans) => ans.charCodeAt(0) - 97 !== optIndex);
      newAnswers = newAnswers.map((ans) => {
        const idx = ans.charCodeAt(0) - 97;
        return idx > optIndex ? String.fromCharCode(ans.charCodeAt(0) - 1) : ans;
      });
      newQs[qIndex] = {
        ...newQs[qIndex],
        options: oldOptions,
        answer: newAnswers,
      };
      return newQs;
    });
  };

  // Update option text
  const handleOptionChange = (qIndex: number, optIndex: number, value: string) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      const newOptions = [...newQs[qIndex].options];
      newOptions[optIndex] = value;
      newQs[qIndex] = { ...newQs[qIndex], options: newOptions };
      return newQs;
    });
  };

  // Update answers from multiple select dropdown
  const handleAnswerChange = (qIndex: number, selectedOptions: string[]) => {
    setQuestions((prev) => {
      const newQs = [...prev];
      newQs[qIndex] = { ...newQs[qIndex], answer: selectedOptions };
      return newQs;
    });
  };

  // Add new question with default values
  const addQuestion = () => {
    setQuestions((prev) => {
      const newQuestionNumber = prev.length > 0 ? prev[prev.length - 1].questionNumber + 1 : 1;
      const newQs = [
        ...prev,
        {
          questionNumber: newQuestionNumber,
          question: "",
          options: [""],
          answer: [],
          solution: "",
        },
      ];
      return newQs;
    });
  };

  // Remove question by index, and adjust question numbers accordingly
  const removeQuestion = (index: number) => {
    setQuestions((prev) => {
      if (prev.length <= 1) return prev; // Must keep at least one question
      const newQs = prev.filter((_, i) => i !== index);
      // Re-assign question numbers sequentially from 1
      return newQs.map((q, i) => ({ ...q, questionNumber: i + 1 }));
    });
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg w-full h-screen mx-auto font-sans">
      {/* Submit button moved to top */}
      <div className="flex justify-between items-center mb-4 border-b border-b-indigo-200">
        <h1 className="text-3xl font-bold text-indigo-700 pb-2">Test Preview</h1>
        <button
          onClick={handleSubmit}
          className="px-6 py-1 font-bold bg-indigo-600 text-white rounded-md shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          {/* Compact Test Details Cards */}
          <section className="mb-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(formData).map(([key, value]) => (
              <div
                key={key}
                className="bg-indigo-50 border border-indigo-200 rounded-md p-2 shadow-sm flex flex-col justify-center items-center text-center"
              >
                <dt className="text-indigo-700 font-semibold capitalize text-xs mb-1 truncate max-w-[90px]">
                  {key.replace(/([A-Z])/g, " $1")}
                </dt>
                <dd
                  className="text-indigo-900 font-semibold text-sm truncate max-w-[90px]"
                  title={value || "-"}
                >
                  {value || "-"}
                </dd>
              </div>
            ))}
          </section>

          {/* Editable Questions Table with Add/Remove Question */}
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

            {questions.length === 0 ? (
              <p className="text-gray-500">No questions extracted from the document.</p>
            ) : (
              <div className="overflow-auto max-h-[400px] rounded-md shadow-md border border-gray-300">
                <table className="min-w-full divide-y divide-gray-300 table-auto">
                  <thead className="bg-indigo-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-indigo-700 tracking-wider">
                        Q#
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-indigo-700 tracking-wider">
                        Question
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-indigo-700 tracking-wider">
                        Options
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-indigo-700 tracking-wider">
                        Answer(s)
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-indigo-700 tracking-wider">
                        Solution
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-indigo-700 tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {questions.map((q, qIndex) => (
                      <tr
                        key={q.questionNumber}
                        className="even:bg-indigo-50 hover:bg-indigo-100 transition-colors duration-150 align-top"
                      >
                        <td className="px-5 py-3 whitespace-nowrap font-mono text-indigo-600">
                          {q.questionNumber}
                        </td>
                        <td className="px-5 py-3">
                          <textarea
                            value={q.question}
                            onChange={(e) =>
                              handleQuestionChange(qIndex, "question", e.target.value)
                            }
                            className="w-full border border-gray-300 rounded p-1 resize-y"
                            rows={3}
                          />
                        </td>
                        <td className="px-5 py-3 space-y-1">
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => handleOptionChange(qIndex, optIdx, e.target.value)}
                                className="flex-grow border border-gray-300 rounded p-1 text-sm"
                              />
                              <button
                                onClick={() => removeOption(qIndex, optIdx)}
                                type="button"
                                className="text-red-600 hover:text-red-700 font-bold px-2"
                                title="Remove option"
                                disabled={q.options.length <= 1}
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addOption(qIndex)}
                            className="mt-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded text-sm hover:bg-indigo-200"
                          >
                            + Add Option
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
                            className="w-full border border-gray-300 rounded p-1 text-sm font-semibold text-indigo-700"
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
                          <textarea
                            value={q.solution}
                            onChange={(e) =>
                              handleQuestionChange(qIndex, "solution", e.target.value)
                            }
                            className="w-full border border-gray-300 rounded p-1 italic resize-y"
                            rows={2}
                          />
                        </td>
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() => removeQuestion(qIndex)}
                            className="text-red-600 hover:text-red-700 font-bold px-3 py-1 rounded border border-red-600"
                            disabled={questions.length <= 1}
                            title={
                              questions.length <= 1
                                ? "At least one question required"
                                : "Remove question"
                            }
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default Dialog;
