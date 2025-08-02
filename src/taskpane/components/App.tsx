import React, { useState, useEffect, useRef } from "react";
import { checkFormat } from "../../commands/commands";

interface SelectOption {
  value: string;
  label: string;
}

const App: React.FC<{ title: string }> = () => {
  const [form, setForm] = useState({
    testName: "",
    testType: "",
    testCode: "",
    category: "",
    instructions: "",
    duration: "",
    handicappedDuration: "",
    totalQuestions: "",
    totalMarks: "",
    difficulty: "",
    secondaryTestType: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  // Dropdown options (fetched from API)
  const [testTypes, setTestTypes] = useState<SelectOption[]>([]);
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [difficulties, setDifficulties] = useState<SelectOption[]>([]);
  const [instructionsList, setInstructionsList] = useState<SelectOption[]>([]);
  const [secondaryTypes, setSecondaryTypes] = useState<SelectOption[]>([]);

  const dialogRef = useRef<Office.Dialog | null>(null);

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
          });

          // Optional: event handler for dialog closed can be added here
        } else {
          console.error("Failed to open dialog:", result.error);
        }
      }
    );
  };

  useEffect(() => {
    // Mock fetching options from API
    const fetchOptions = async () => {
      // Replace with real API calls
      setTestTypes([
        { value: "objective", label: "Objective" },
        { value: "subjective", label: "Subjective" },
      ]);
      setCategories([
        { value: "math", label: "Math" },
        { value: "science", label: "Science" },
      ]);
      setInstructionsList([
        { value: "open_book", label: "Open Book" },
        { value: "closed_book", label: "Closed Book" },
      ]);
      setDifficulties([
        { value: "easy", label: "Easy" },
        { value: "medium", label: "Medium" },
        { value: "hard", label: "Hard" },
      ]);
      setSecondaryTypes([
        { value: "demo", label: "Demo Test" },
        { value: "practice", label: "Practice Test" },
      ]);
    };

    fetchOptions();
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    for (const key in form) {
      if (!form[key as keyof typeof form].trim()) {
        newErrors[key] = "This field is required";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const createTest = async () => {
    if (!validate()) return;

    const result = await checkFormat();
    if (!result.success) {
      setMessage(result.message || "An unknown error occurred.");
      setIsError(true);
      return;
    }

    setMessage(result.message);
    setIsError(false);

    const formPayload = JSON.stringify(form);

    let questionsPayload = "[]"; // fallback empty JSON array string
    try {
      const storedQuestions = await OfficeRuntime.storage.getItem("lastExtractedJson");
      if (storedQuestions) {
        questionsPayload = storedQuestions;
      }
    } catch {
      // Storage not available or failed, fallback to empty
    }

    setForm({
      testName: "",
      testType: "",
      testCode: "",
      category: "",
      instructions: "",
      duration: "",
      handicappedDuration: "",
      totalQuestions: "",
      totalMarks: "",
      difficulty: "",
      secondaryTestType: "",
    });

    openDialog(formPayload, questionsPayload);
  };

  const renderInput = (name: string, label: string, type: "text" | "number" = "text") => (
    <div className="flex flex-col">
      <label htmlFor={name} className="font-semibold">
        {label}
      </label>
      <input
        type={type}
        name={name}
        id={name}
        value={form[name as keyof typeof form]}
        onChange={handleChange}
        className="px-4 py-2 rounded-xl border border-gray-300 shadow-sm"
      />
      {errors[name] && <span className="text-red-500 text-sm font-bold">{errors[name]}</span>}
    </div>
  );

  const renderSelect = (name: string, label: string, options: SelectOption[]) => (
    <div className="flex flex-col">
      <label htmlFor={name} className="font-semibold">
        {label}
      </label>
      <select
        name={name}
        id={name}
        value={form[name as keyof typeof form]}
        onChange={handleChange}
        className="px-4 py-2 rounded-xl border border-gray-300 shadow-sm"
      >
        <option value="">-- Select --</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {errors[name] && <span className="text-red-500 text-sm font-bold">{errors[name]}</span>}
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold border-b border-b-gray-300 pb-2 mb-4 text-gray-700">
        <span className="text-indigo-500">E</span>
        valus Test Creation Portal
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderInput("testName", "Test Name")}
        {renderSelect("testType", "Test Type", testTypes)}
        {renderInput("testCode", "Test Code")}
        {renderSelect("category", "Category", categories)}
        {renderSelect("instructions", "Instructions", instructionsList)}
        {renderInput("duration", "Duration (min)", "number")}
        {renderInput("handicappedDuration", "Handicapped Duration (min)", "number")}
        {renderInput("totalQuestions", "Total Questions", "number")}
        {renderInput("totalMarks", "Total Marks", "number")}
        {renderSelect("difficulty", "Difficulty", difficulties)}
        {renderSelect("secondaryTestType", "Secondary Test Type", secondaryTypes)}
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg ${
            isError ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      <button
        onClick={createTest}
        className="w-full mt-4 font-bold px-6 py-2 bg-indigo-600 text-white rounded-xl shadow hover:bg-indigo-700 transition"
      >
        Create Test
      </button>
    </div>
  );
};

export default App;
