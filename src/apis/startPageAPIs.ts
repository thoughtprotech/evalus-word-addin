import { APIResponse, PatternInterface } from "../types/endpointTypes";

export async function fetchPatterns(): Promise<APIResponse<PatternInterface[]>> {
  try {
    const res = await fetch(
      "https://evalusdevapi.thoughtprotraining.com/api/Patterns?includeInactive=false"
    );

    const response = await res.json();

    return {
      status: 200,
      message: "Fetched Question Patterns",
      error: false,
      data: response.data,
    };
  } catch (error) {
    return {
      status: 500,
      message: "Something Went Wrong",
      error: true,
    };
  }
}

export async function submitQuestions(payload): Promise<APIResponse<null>> {
  try {
    const res = await fetch(
      "https://evalusdevapi.thoughtprotraining.com/api/Tests/create-questions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({questions: payload}),
      }
    );

    const response = await res.json();

    return {
      status: res.status,
      message: response.message || "Questions Submitted",
      error: response.error || false,
    };
  } catch (error) {
    return {
      status: 500,
      message: "Something Went Wrong",
      error: true,
    };
  }
}
