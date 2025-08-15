import React, { useEffect, useState } from "react";
import { fetchPatterns } from "../../apis/startPageAPIs";
import { PatternInterface } from "../../types/endpointTypes";
import { Book, LogOut, Sparkles } from "lucide-react";
import PatternSelect from "./PatternSelect";
import { checkFormat } from "../../commands/commands";

export default function Start() {
  const [patterns, setPatterns] = useState<PatternInterface[]>([]);
  const [selected, setSelected] = useState({
    question: "",
    option: "",
    solution: "",
    answer: "",
  });

  const getPatterns = async () => {
    const res = await fetchPatterns();
    setPatterns(res.data || []);
  };

  useEffect(() => {
    getPatterns();
  }, []);

  const filterByType = (type: PatternInterface["patternType"]) =>
    patterns.filter((p) => p.patternType === type);

  const handleReadNow = async () => {
    const result = await checkFormat();
    console.log({ result });
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
      <main className="flex-1 w-full max-w-4xl p-4">
        <div className="bg-white shadow-lg rounded-xl p-6 space-y-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Set Patterns</h2>

          {/* Dropdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <PatternSelect
              label="Question Pattern"
              patterns={filterByType("question")}
              value={selected.question}
              onChange={(val) => setSelected({ ...selected, question: val })}
            />
            <PatternSelect
              label="Option Pattern"
              patterns={filterByType("option")}
              value={selected.option}
              onChange={(val) => setSelected({ ...selected, option: val })}
            />
            <PatternSelect
              label="Solution Pattern"
              patterns={filterByType("solution")}
              value={selected.solution}
              onChange={(val) => setSelected({ ...selected, solution: val })}
            />
            <PatternSelect
              label="Answer Pattern"
              patterns={filterByType("answer")}
              value={selected.answer}
              onChange={(val) => setSelected({ ...selected, answer: val })}
            />
          </div>

          {/* Buttons at the bottom */}
          <div className="flex flex-col gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition font-semibold justify-center"
              onClick={handleReadNow}
            >
              <Book size={18} /> Read Now
            </button>
            <button
              type="button"
              className="flex items-center gap-2 bg-red-500 text-white px-5 py-2 rounded-lg hover:bg-red-600 transition font-semibold justify-center"
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
