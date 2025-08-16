import React from "react";
import { PatternInterface } from "../../types/endpointTypes";

interface PatternField {
  value: string;
  label: string;
}

interface PatternSelectProps {
  label: string;
  patterns: PatternInterface[];
  value: PatternField;
  onChange: (value: PatternField) => void;
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
        value={value.value}
        onChange={e => {
          const selected = patterns.find(
            (p: PatternInterface) => String(p.patternId) === e.target.value
          );
          if (selected) {
            onChange({
              value: String(selected.patternId),
              label: selected.patternText,
            });
          } else {
            onChange({ value: "", label: "" });
          }
        }}
        className="border border-gray-300 px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select a {label}</option>
        {patterns.map((pat: PatternInterface) => (
          <option key={String(pat.patternId)} value={String(pat.patternId)}>
            {pat.patternText}
          </option>
        ))}
      </select>
    </div>
  );
}
