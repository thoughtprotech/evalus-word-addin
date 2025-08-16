import React, { useEffect, useRef, useState } from "react";
import { fetchPatterns } from "../../apis/startPageAPIs";
import { PatternInterface } from "../../types/endpointTypes";
import { Book, LogOut } from "lucide-react";
import PatternSelect from "./PatternSelect";
import { checkFormat } from "../../commands/commands";

type PatternField = { value: string; label: string };

interface SelectedPatterns {
  question: PatternField;
  option: PatternField;
  solution: PatternField;
  answer: PatternField;
}

export default function Start() {
  const [patterns, setPatterns] = useState<PatternInterface[]>([]);
  const [selected, setSelected] = useState<SelectedPatterns>({
    question: { value: "", label: "" },
    option: { value: "", label: "" },
    solution: { value: "", label: "" },
    answer: { value: "", label: "" },
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const dialogRef = useRef<Office.Dialog | null>(null);

  const getPatterns = async () => {
    const res = await fetchPatterns();
    setPatterns(res.data || []);
  };

  useEffect(() => {
    getPatterns();
  }, []);

  const filterByType = (type: PatternInterface["patternType"]) =>
    patterns.filter((p) => p.patternType === type);

  const openDialog = (formPayload: string, questionsPayload: string) => {
    Office.context.ui.displayDialogAsync(
      window.location.origin + "/dialog.html",
      { height: 200, width: 300 },
      (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          dialogRef.current = result.value;
          dialogRef.current.addEventHandler(Office.EventType.DialogMessageReceived, (arg) => {
            if ("message" in arg && arg.message === "dialogReady") {
              dialogRef.current?.messageChild(
                JSON.stringify({ form: formPayload, questions: questionsPayload })
              );
            }
            if ("message" in arg && arg.message === "closeDialog") {
              dialogRef.current?.close();
            }
          });
        } else {
          console.error("Failed to open dialog:", result.error);
        }
      }
    );
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    for (const key in selected) {
      // Each field must have a non-empty value
      if (!(selected as any)[key].value.trim()) {
        newErrors[key] = "This field is required";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReadNow = async () => {
    if (!validate()) return;

    const result = await checkFormat();
    if (!result.success) {
      setMessage(result.message || "An unknown error occurred.");
      setIsError(true);
      return;
    }
    setMessage(result.message);
    setIsError(false);

    console.log({ result });

    // Consider sending only value or both value and label as per your backend expectation
    const toSend = {
      question: selected.question,
      option: selected.option,
      solution: selected.solution,
      answer: selected.answer,
    };
    const formPayload = JSON.stringify(toSend);

    let questionsPayload = "[]";
    try {
      const storedQuestions = await OfficeRuntime.storage.getItem("lastExtractedJson");
      if (storedQuestions) {
        questionsPayload = storedQuestions;
        console.log({ storedQuestions });
      }
    } catch {
      // ignore
    }
    openDialog(formPayload, questionsPayload);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center">
      {/* Top Branding */}
      <header className="w-full bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-800">
            <span className="text-indigo-500">E</span>
            valus
          </h1>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="flex-1 w-full max-w-4xl p-2">
        <div className="bg-white shadow-lg rounded-xl p-4 space-y-2 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Set Patterns</h2>

          {/* Dropdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { label: "Question Pattern", value: "question" },
              { label: "Option Pattern", value: "option" },
              { label: "Solution Pattern", value: "solution" },
              { label: "Answer Pattern", value: "answer" },
            ].map(({ label, value }) => {
              return (
                <div className="w-full flex flex-col gap-1" key={value}>
                  <PatternSelect
                    label={label}
                    patterns={filterByType(
                      value as "question" | "option" | "solution" | "answer" | "writeup"
                    )}
                    value={selected[value]}
                    // Make sure your PatternSelect returns the full { value, label }
                    onChange={(val: PatternField) => {
                      console.log({ val });
                      setSelected({ ...selected, [value]: val });
                    }}
                  />
                  {errors[value] && (
                    <span className="bg-red-100 text-red-700 p-1 px-2 w-full rounded-lg text-xs">
                      {errors[value]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {message && (
            <div
              className={`p-1 px-2 w-full rounded-lg text-xs ${
                isError ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
              }`}
            >
              {message}
            </div>
          )}

          {/* Buttons at the bottom */}
          <div className="flex flex-col gap-2 pt-2 border-t border-gray-200">
            <button
              type="button"
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition font-semibold justify-center cursor-pointer"
              onClick={handleReadNow}
            >
              <Book size={18} /> Read Now
            </button>
            <button
              type="button"
              className="flex items-center gap-2 bg-red-500 text-white px-5 py-2 rounded-lg hover:bg-red-600 transition font-semibold justify-center cursor-pointer"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
