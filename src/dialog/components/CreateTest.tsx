import React, { useEffect, useState } from "react";
import { File, LayoutGrid, TableIcon } from "lucide-react";
import {
  createTest,
  fetchSectionList,
  fetchTestCategoryList,
  fetchTestDifficultyList,
  fetchTestInstructionsList,
  fetchTestTypeList,
} from "../../apis/createTestAPIs";
import {
  GetSectionListInterface,
  GetTestCategoryListInterface,
  GetTestDifficultyInterface,
  GetTestInstructionsInterface,
  GetTestListInterface,
} from "../../types/endpointTypes";
import toast from "react-hot-toast";

// ----- INTERFACES -----
interface Question {
  questionNumber: number;
  question: string;
  questionHtml?: string;
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
  questionDifficultyId?: number | string;
  chapter?: string;
  subtopic?: string;
  sectionId?: number;
}

interface TestMetaData {
  testName: string;
  testType: number | ""; // Changed to number type for IDs
  testCode: string;
  category: number | "";
  instructions: number | "";
  duration: string;
  handicappedDuration: string;
  totalQuestions: string;
  totalMarks: string;
  testDifficultyLevel1: number | "";
}

interface SectionOption {
  id: number;
  name: string;
}

// Mapping helpers to convert API response data to option formats
const mapSectionsToOptions = (sections: GetSectionListInterface[]): SectionOption[] =>
  sections.map((s) => ({ id: s.testSectionId, name: s.testSectionName }));

const mapTestTypesToOptions = (types: GetTestListInterface[]): { id: number; name: string }[] =>
  types.map((t) => ({ id: t.testTypeId, name: t.testType1 }));

const mapCategoriesToOptions = (
  cats: GetTestCategoryListInterface[]
): { id: number; name: string }[] =>
  cats.map((c) => ({ id: c.testCategoryId, name: c.testCategoryName }));

const mapDifficultyToOptions = (
  diffs: GetTestDifficultyInterface[]
): { id: number; name: string }[] =>
  diffs.map((d) => ({ id: d.testDifficultyLevelId, name: d.testDifficultyLevel1 }));

const mapInstructionsToOptions = (
  insts: GetTestInstructionsInterface[]
): { id: number; name: string }[] =>
  insts.map((i) => ({ id: i.testInstructionId, name: i.testInstruction1 }));

// ----- MAIN COMPONENT -----
export default function CreateTest({ questions }: { questions: Question[] }) {
  const [testMeta, setTestMeta] = useState<TestMetaData>({
    testName: "",
    testType: "",
    testCode: "",
    category: "",
    instructions: "",
    duration: "",
    handicappedDuration: "",
    totalQuestions: questions.length.toString(),
    totalMarks: "",
    testDifficultyLevel1: "",
  });

  // Dropdown option states for IDs and labels
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [testTypes, setTestTypes] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [difficultyLevels, setDifficultyLevels] = useState<{ id: number; name: string }[]>([]);
  const [instructionsList, setInstructionsList] = useState<{ id: number; name: string }[]>([]);

  // Loading states
  const [loadingSection, setLoadingSection] = useState(true);
  const [loadingTestType, setLoadingTestType] = useState(true);
  const [loadingCategory, setLoadingCategory] = useState(true);
  const [loadingDifficulty, setLoadingDifficulty] = useState(true);
  const [loadingInstruction, setLoadingInstruction] = useState(true);

  // Section assignment related state
  const [rangeStart, setRangeStart] = useState<number | "">(1);
  const [rangeEnd, setRangeEnd] = useState<number | "">(questions.length || 1);
  const [selectedSectionId, setSelectedSectionId] = useState<number | "">("");
  const [localQuestions, setLocalQuestions] = useState<Question[]>(questions);
  const [viewMode, setViewMode] = useState<"card" | "table">("table");

  // Fetch dropdown options from APIs and map to id-name pairs
  useEffect(() => {
    setLoadingSection(true);
    fetchSectionList()
      .then((res) => {
        if (!res.error && res.data) setSections(mapSectionsToOptions(res.data));
      })
      .finally(() => setLoadingSection(false));

    setLoadingTestType(true);
    fetchTestTypeList()
      .then((res) => {
        if (!res.error && res.data) setTestTypes(mapTestTypesToOptions(res.data));
      })
      .finally(() => setLoadingTestType(false));

    setLoadingCategory(true);
    fetchTestCategoryList()
      .then((res) => {
        if (!res.error && res.data) setCategories(mapCategoriesToOptions(res.data));
      })
      .finally(() => setLoadingCategory(false));

    setLoadingDifficulty(true);
    fetchTestDifficultyList()
      .then((res) => {
        if (!res.error && res.data) setDifficultyLevels(mapDifficultyToOptions(res.data));
      })
      .finally(() => setLoadingDifficulty(false));

    setLoadingInstruction(true);
    fetchTestInstructionsList()
      .then((res) => {
        if (!res.error && res.data) setInstructionsList(mapInstructionsToOptions(res.data));
      })
      .finally(() => setLoadingInstruction(false));
  }, []);

  useEffect(() => {
    setTestMeta((prev) => ({
      ...prev,
      totalQuestions: localQuestions.length.toString(),
    }));
  }, [localQuestions.length]);

  // Handlers for inputs with IDs as values
  const handleMetaChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTestMeta((prev) => ({ ...prev, [name]: value }));
  };

  const handleMetaDropdown = (name: keyof TestMetaData, value: number | "") => {
    setTestMeta((prev) => ({ ...prev, [name]: value }));
  };

  // Apply selected section ID to questions in range
  const handleApplySection = () => {
    if (
      typeof rangeStart !== "number" ||
      typeof rangeEnd !== "number" ||
      !selectedSectionId ||
      rangeStart < 1 ||
      rangeEnd > localQuestions.length ||
      rangeEnd < rangeStart
    )
      return;

    setLocalQuestions((prev) =>
      prev.map((q) =>
        q.questionNumber >= rangeStart && q.questionNumber <= rangeEnd
          ? { ...q, sectionId: Number(selectedSectionId) }
          : q
      )
    );
  };

  const handleSaveTest = async () => {
    // Validate testMeta required fields (non-empty / valid)
    const {
      testName,
      testType,
      testCode,
      category,
      instructions,
      duration,
      handicappedDuration,
      totalQuestions,
      totalMarks,
      testDifficultyLevel1,
    } = testMeta;

    if (
      !testName.trim() ||
      !testType ||
      !testCode.trim() ||
      !category ||
      !instructions ||
      !duration.trim() ||
      !handicappedDuration.trim() ||
      !totalQuestions.trim() ||
      !totalMarks.trim() ||
      !testDifficultyLevel1
    ) {
      toast.error("Please fill in all required test metadata fields.");
      return;
    }

    // Validate every question has a sectionId
    const questionsMissingSection = localQuestions.filter((q) => !q.sectionId);
    if (questionsMissingSection.length > 0) {
      toast.error(
        `Please assign sections to all questions. ${questionsMissingSection.length} question(s) missing section.`
      );
      return;
    }

    // Prepare payload mapping (adjust as per your API needs)
    const payload = {
      testMetaData: testMeta,
      questions: localQuestions.map((q) => ({
        questionNumber: q.questionNumber,
        question: q.questionHtml ?? q.question,
        options: q.optionsHtml ?? q.options,
        answer: q.answerHtml ? [q.answerHtml] : q.answer,
        solution: q.solutionHtml ?? q.solution,
        questionTypeId: 1, // or assign dynamically if needed
        subjectId: q.subject,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        graceMarks: q.graceMarks,
        questionDifficultyLevelId: q.questionDifficultyId,
        sectionId: q.sectionId,
        language: q.language,
        allowCandidateComments: false,
      })),
    };

    // Call createTest API
    try {
      const res = await createTest(payload);
      if (res.status === 201) {
        toast.success("Test Saved");
        Office.context.ui.messageParent("closeDialog");
      } else {
        toast.error(res.message || "Failed to save test");
      }
    } catch (error) {
      toast.error("An error occurred while saving the test.");
    }
  };

  return (
    <div className="w-full mx-auto mt-6 bg-gray-50 rounded-xl shadow-lg p-8 space-y-8">
      {/* TEST METADATA */}
      <div>
        <div className="w-full flex item-center justify-between">
          <h2 className="text-xl font-bold mb-4 flex gap-2 items-center">
            <File className="w-6 h-6 text-indigo-600" /> Test Metadata
          </h2>
          <div>
            <button
              type="button"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow"
              onClick={handleSaveTest}
            >
              Save Test
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {/* Test Name */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">Test Name</label>
            <input
              className="border rounded-lg px-3 py-2 text-sm"
              type="text"
              name="testName"
              placeholder="Test Name"
              value={testMeta.testName}
              onChange={handleMetaChange}
            />
          </div>

          {/* Test Type Dropdown - value is ID */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">Test Type</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              name="testType"
              value={testMeta.testType}
              onChange={(e) =>
                handleMetaDropdown("testType", e.target.value ? Number(e.target.value) : "")
              }
              disabled={loadingTestType}
            >
              <option value="">{loadingTestType ? "Loading..." : "Select Test Type"}</option>
              {testTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Test Code */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">Test Code</label>
            <input
              className="border rounded-lg px-3 py-2 text-sm"
              type="text"
              name="testCode"
              placeholder="Test Code"
              value={testMeta.testCode}
              onChange={handleMetaChange}
            />
          </div>

          {/* Category Dropdown - value is ID */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              name="category"
              value={testMeta.category}
              onChange={(e) =>
                handleMetaDropdown("category", e.target.value ? Number(e.target.value) : "")
              }
              disabled={loadingCategory}
            >
              <option value="">{loadingCategory ? "Loading..." : "Select Category"}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
            <input
              className="border rounded-lg px-3 py-2 text-sm"
              type="text"
              name="duration"
              placeholder="Duration (minutes)"
              value={testMeta.duration}
              onChange={handleMetaChange}
            />
          </div>

          {/* Handicapped Duration */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">
              Handicapped Duration (minutes)
            </label>
            <input
              className="border rounded-lg px-3 py-2 text-sm"
              type="text"
              name="handicappedDuration"
              placeholder="Handicapped Duration (minutes)"
              value={testMeta.handicappedDuration}
              onChange={handleMetaChange}
            />
          </div>

          {/* Total Marks */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">Total Marks</label>
            <input
              className="border rounded-lg px-3 py-2 text-sm"
              type="text"
              name="totalMarks"
              placeholder="Total Marks"
              value={testMeta.totalMarks}
              onChange={handleMetaChange}
            />
          </div>

          {/* Difficulty Level Dropdown - value is ID */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">Difficulty Level</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              name="testDifficultyLevel1"
              value={testMeta.testDifficultyLevel1}
              onChange={(e) =>
                handleMetaDropdown(
                  "testDifficultyLevel1",
                  e.target.value ? Number(e.target.value) : ""
                )
              }
              disabled={loadingDifficulty}
            >
              <option value="">{loadingDifficulty ? "Loading..." : "Select Difficulty"}</option>
              {difficultyLevels.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Instructions Dropdown - value is ID */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">Instructions</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              name="instructions"
              value={testMeta.instructions}
              onChange={(e) =>
                handleMetaDropdown("instructions", e.target.value ? Number(e.target.value) : "")
              }
              disabled={loadingInstruction}
            >
              <option value="">
                {loadingInstruction ? "Loading Instructions..." : "Select Instructions"}
              </option>
              {instructionsList.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SECTION ASSIGNMENT */}
      <div>
        <h2 className="text-lg font-bold mb-3 text-indigo-700">Assign Section to Question Range</h2>
        <div className="flex gap-3 items-center">
          <label className="text-sm font-medium">From Q#</label>
          <input
            className="w-20 border rounded-lg px-2 py-1 text-sm"
            type="number"
            min={1}
            max={localQuestions.length}
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value ? Number(e.target.value) : "")}
          />
          <label className="text-sm font-medium">To Q#</label>
          <input
            className="w-20 border rounded-lg px-2 py-1 text-sm"
            type="number"
            min={1}
            max={localQuestions.length}
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value ? Number(e.target.value) : "")}
          />
          <select
            className="border rounded-lg px-2 py-1 text-sm"
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value ? Number(e.target.value) : "")}
            disabled={loadingSection}
          >
            <option value="">{loadingSection ? "Loading..." : "Select Section"}</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow"
            onClick={handleApplySection}
            disabled={
              !selectedSectionId ||
              !rangeStart ||
              !rangeEnd ||
              typeof rangeStart !== "number" ||
              typeof rangeEnd !== "number" ||
              rangeEnd < rangeStart
            }
          >
            Apply Section
          </button>
        </div>
      </div>

      {/* QUESTIONS PREVIEW */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold text-indigo-700">Questions ({localQuestions.length})</h2>
          {/* View toggle buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium shadow cursor-pointer ${
                viewMode === "card" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              <LayoutGrid className="w-4 h-4" /> Card View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium shadow cursor-pointer ${
                viewMode === "table" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              <TableIcon className="w-4 h-4" /> Table View
            </button>
          </div>
        </div>

        {viewMode === "card" ? (
          // CARD VIEW (existing)
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {localQuestions.map((q, idx) => (
              <div
                key={q.questionNumber + "-" + idx}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
              >
                <div className="flex justify-between mb-3">
                  <span className="text-xs text-indigo-700 font-bold">Q{q.questionNumber}</span>
                  {q.sectionId && (
                    <span className="bg-indigo-600/10 px-2 py-1 rounded-full text-xs text-indigo-700 font-semibold">
                      Section: {sections.find((s) => s.id === q.sectionId)?.name || q.sectionId}
                    </span>
                  )}
                </div>
                <div className="font-medium mb-2 text-gray-800">{q.question}</div>
                <ul className="list-disc ml-5 text-gray-600 text-sm mb-2">
                  {q.options.map((opt, i) => (
                    <li key={i}>{opt}</li>
                  ))}
                </ul>
                <div className="text-sm text-gray-500 mb-1">Answer: {q.answer.join(", ")}</div>
                <div className="text-xs text-gray-400 italic">Solution: {q.solution}</div>
              </div>
            ))}
          </div>
        ) : (
          // TABLE VIEW
          <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
            <table className="min-w-full border-collapse divide-y divide-gray-200 text-sm">
              <thead className="bg-indigo-100">
                <tr>
                  <th className="p-2 text-left">Q#</th>
                  <th className="p-2 text-left">Section</th>
                  <th className="p-2 text-left">Question</th>
                  <th className="p-2 text-left">Options</th>
                  <th className="p-2 text-left">Answer</th>
                  <th className="p-2 text-left">Solution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {localQuestions.map((q, idx) => (
                  <tr key={q.questionNumber + "-" + idx}>
                    <td className="p-2 font-medium text-indigo-700">{q.questionNumber}</td>
                    <td className="p-2">
                      {q.sectionId
                        ? sections.find((s) => s.id === q.sectionId)?.name || q.sectionId
                        : "-"}
                    </td>
                    <td className="p-2">{q.question}</td>
                    <td className="p-2">
                      <ul className="list-disc ml-4">
                        {q.options.map((opt, i) => (
                          <li key={i}>{opt}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-2">{q.answer.join(", ")}</td>
                    <td className="p-2 text-gray-500 text-xs">{q.solution}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FINAL PAYLOAD PRINT FOR DEV */}
      {/* <div className="mt-8 bg-gray-100 rounded-xl p-4 font-mono text-xs overflow-auto">
        <div className="mb-1 font-bold text-gray-700">Payload Preview:</div>
        <pre>{JSON.stringify({ testMetaData: testMeta, questions: localQuestions }, null, 2)}</pre>
      </div> */}
    </div>
  );
}
