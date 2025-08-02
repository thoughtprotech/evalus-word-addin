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

const Dialog = () => {
  const [formData, setFormData] = useState<FormData | null>(null);

  useEffect(() => {
    Office.onReady(() => {
      // Notify parent that dialog is ready to receive messages
      Office.context.ui.messageParent("dialogReady");

      Office.context.ui.addHandlerAsync(Office.EventType.DialogParentMessageReceived, (arg) => {
        try {
          const data: FormData = JSON.parse(arg.message);
          setFormData(data);
        } catch (e) {
          setFormData(null);
        }
      });
    });
  }, []);

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg w-full h-screen mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-4 text-indigo-600">Test Preview</h1>
      {!formData ? (
        <p className="text-gray-500">Waiting for test data...</p>
      ) : (
        <div className="space-y-3 text-gray-700">
          <div>
            <h2 className="font-semibold">Test Name:</h2>
            <p>{formData.testName}</p>
          </div>
          <div>
            <h2 className="font-semibold">Test Type:</h2>
            <p>{formData.testType}</p>
          </div>
          <div>
            <h2 className="font-semibold">Test Code:</h2>
            <p>{formData.testCode}</p>
          </div>
          <div>
            <h2 className="font-semibold">Category:</h2>
            <p>{formData.category}</p>
          </div>
          <div>
            <h2 className="font-semibold">Instructions:</h2>
            <p>{formData.instructions}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h2 className="font-semibold">Duration:</h2>
              <p>{formData.duration} min</p>
            </div>
            <div>
              <h2 className="font-semibold">Handicapped Duration:</h2>
              <p>{formData.handicappedDuration} min</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h2 className="font-semibold">Total Questions:</h2>
              <p>{formData.totalQuestions}</p>
            </div>
            <div>
              <h2 className="font-semibold">Total Marks:</h2>
              <p>{formData.totalMarks}</p>
            </div>
          </div>
          <div>
            <h2 className="font-semibold">Difficulty:</h2>
            <p>{formData.difficulty}</p>
          </div>
          <div>
            <h2 className="font-semibold">Secondary Test Type:</h2>
            <p>{formData.secondaryTestType}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dialog;
