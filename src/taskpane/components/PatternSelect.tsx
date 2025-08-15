import React from "react";
import { PatternInterface } from "../../types/endpointTypes";

interface PatternSelectProps {
  label: string;
  patterns: PatternInterface[];
  value: string;
  onChange: (value: string) => void;
}

export default function PatternSelect({
  label,
  patterns,
  value,
  onChange,
}: PatternSelectProps) {
  return (
    <div>
      <label className="block mb-1 font-medium text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select a {label}</option>
        {patterns.map((pat) => (
          <option key={pat.patternId} value={pat.patternId}>
            {pat.patternText}
          </option>
        ))}
      </select>
    </div>
  );
}
