import React, { useState, useEffect, useRef } from "react";
import { checkFormat } from "../../commands/commands";

interface SelectOption {
  value: string;
  label: string;
}

/* -------------------------
   Start Page Component
------------------------- */
const StartPage: React.FC<{
  onCreateTest: () => void;
  onCreateQuestions: () => void;
}> = ({ onCreateTest, onCreateQuestions }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-700 mb-8">
        Evalus Portal
      </h1>
      <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
        <button
          onClick={onCreateTest}
          className="w-full px-6 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-xl shadow hover:bg-indigo-700 transition"
        >
          Create Test
        </button>
        <button
          onClick={onCreateQuestions}
          className="w-full px-6 py-4 bg-green-600 text-white text-lg font-semibold rounded-xl shadow hover:bg-green-700 transition"
        >
          Create Questions
        </button>
      </div>
    </div>
  );
};

/* -------------------------
   Test Creation Form
   (Your existing App logic)
------------------------- */
const TestCreationForm = ({ }) => {
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
    testDifficultyLevel1: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  // Dropdown options
  const [testTypes, setTestTypes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [difficulties, setDifficulties] = useState<any[]>([]);
  const [instructionsList, setInstructionsList] = useState<any[]>([]);

  const dialogRef = useRef<Office.Dialog | null>(null);

  async function fetchTestTypes() {
    try {
      const res = await fetch(
        "https://evalusdevapi.thoughtprotraining.com/api/TestTypes?includeInactive=false&language=English"
      );
      const data = await res.json();
      setTestTypes(data.data);
    } catch {
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
    } catch {
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
    } catch {
      setInstructionsList([]);
    }
  }
  async function fetchDifficulties() {
    try {
      const res = await fetch(
        "https://evalusdevapi.thoughtprotraining.com/api/TestDifficultyLevels?includeInactive=false"
      );
      const data = await res.json();
      setDifficulties(data.data || []);
    } catch {
      setDifficulties([]);
    }
  }

  useEffect(() => {
    fetchTestTypes();
    fetchCategories();
    fetchInstructions();
    fetchDifficulties();
  }, []);

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
    for (const key in form) {
      if (!form[key as keyof typeof form].trim()) {
        newErrors[key] = "This field is required";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
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

    let questionsPayload = "[]";
    try {
      const storedQuestions = await OfficeRuntime.storage.getItem("lastExtractedJson");
      if (storedQuestions) {
        questionsPayload = storedQuestions;
      }
    } catch {
      // ignore
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
      testDifficultyLevel1: "",
    });

    openDialog(formPayload, questionsPayload);
  };

  const renderInput = (name: string, label: string, type: "text" | "number" = "text") => (
    <div className="flex flex-col">
      <label htmlFor={name} className="font-semibold">{label}</label>
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
      <label htmlFor={name} className="font-semibold">{label}</label>
      <select
        name={name}
        id={name}
        value={form[name as keyof typeof form]}
        onChange={handleChange}
        className="px-4 py-2 rounded-xl border border-gray-300 shadow-sm"
      >
        <option value="">-- Select --</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {errors[name] && <span className="text-red-500 text-sm font-bold">{errors[name]}</span>}
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold border-b border-b-gray-300 pb-2 mb-4 text-gray-700">
        <span className="text-indigo-500">E</span>valus Test Creation Portal
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderInput("testName", "Test Name")}
        {renderSelect(
          "testType",
          "Test Type",
          testTypes.map((t) => ({ label: t.testType1, value: t.testTypeId?.toString() }))
        )}
        {renderInput("testCode", "Test Code")}
        {renderSelect(
          "category",
          "Category",
          categories.map((c) => ({ label: c.testCategoryName, value: c.testCategoryId.toString() }))
        )}
        {renderSelect(
          "instructions",
          "Instructions",
          instructionsList.map((i) => ({ label: i.testInstructionName, value: i.testInstructionId.toString() }))
        )}
        {renderInput("duration", "Duration (min)", "number")}
        {renderInput("handicappedDuration", "Handicapped Duration (min)", "number")}
        {renderInput("totalQuestions", "Total Questions", "number")}
        {renderInput("totalMarks", "Total Marks", "number")}
        {renderSelect(
          "testDifficultyLevel1",
          "Difficulty",
          difficulties.map((d) => ({
            label: d.testDifficultyLevel1,
            value: d.testDifficultyLevelId.toString()
          }))
        )}
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg ${isError ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
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

/* -------------------------
   Main Container
------------------------- */
const MainContainer: React.FC = () => {
  const [view, setView] = useState<"start" | "test">("start");
  const dialogRef = useRef<Office.Dialog | null>(null);

  const openQuestionDialog = async () => {
    let questionsPayload = "[]";
    try {
      const storedQuestions = await OfficeRuntime.storage.getItem("lastExtractedJson");
      if (storedQuestions) {
        questionsPayload = storedQuestions;
      }
    } catch {
      // ignore
    }

    Office.context.ui.displayDialogAsync(
      window.location.origin + "/questionDialog.html",
      { height: 200, width: 300 },
      (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          dialogRef.current = result.value;
          dialogRef.current.addEventHandler(Office.EventType.DialogMessageReceived, (arg) => {
            if ("message" in arg && arg.message === "dialogReady") {
              dialogRef.current?.messageChild(questionsPayload);
            }
            if ("message" in arg && arg.message === "closeDialog") {
              dialogRef.current?.close();
            }
          });
        } else {
          console.error("Failed to open question dialog:", result.error);
        }
      }
    );
  };

  if (view === "start") {
    return (
      <StartPage
        onCreateTest={() => setView("test")}
        onCreateQuestions={openQuestionDialog}
      />
    );
  }

  if (view === "test") {
    return <TestCreationForm />;
  }

  return null;
};

export default MainContainer;
