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
      error: true,
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
