import {
  APIResponse,
  GetSectionListInterface,
  GetTestCategoryListInterface,
  GetTestDifficultyInterface,
  GetTestInstructionsInterface,
  GetTestListInterface,
} from "../types/endpointTypes";

export async function fetchSectionList(): Promise<APIResponse<GetSectionListInterface[]>> {
  try {
    const res = await fetch("https://evalusdevapi.thoughtprotraining.com/api/TestSections");

    const response = await res.json();

    return {
      status: 200,
      message: "Fetched Section List",
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

export async function fetchTestTypeList(): Promise<APIResponse<GetTestListInterface[]>> {
  try {
    const res = await fetch(
      "https://evalusdevapi.thoughtprotraining.com/api/TestTypes?includeInactive=false"
    );

    const response = await res.json();

    return {
      status: 200,
      message: "Fetched Test Type List",
      data: response.data,
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

export async function fetchTestCategoryList(): Promise<
  APIResponse<GetTestCategoryListInterface[]>
> {
  try {
    const res = await fetch(
      "https://evalusdevapi.thoughtprotraining.com/api/TestCategories?includeInactive=false"
    );

    const response = await res.json();

    return {
      status: 200,
      message: "Fetched Test Category List",
      data: response.data,
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

export async function fetchTestDifficultyList(): Promise<
  APIResponse<GetTestDifficultyInterface[]>
> {
  try {
    const res = await fetch(
      "https://evalusdevapi.thoughtprotraining.com/api/TestDifficultyLevels?includeInactive=false"
    );

    const response = await res.json();

    return {
      status: 200,
      message: "Fetched Test Difficulty List",
      data: response.data,
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

export async function fetchTestInstructionsList(): Promise<
  APIResponse<GetTestInstructionsInterface[]>
> {
  try {
    const res = await fetch(
      "https://evalusdevapi.thoughtprotraining.com/api/TestInstructions?includeInactive=false"
    );

    const response = await res.json();

    return {
      status: 200,
      message: "Fetched Test Instruciton List",
      data: response.data,
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

export async function createTest(payload): Promise<APIResponse<null>> {
  try {
    const res = await fetch(
      "https://evalusdevapi.thoughtprotraining.com/api/Tests/create-with-questions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload }),
      }
    );

    const response = await res.json();

    return {
      status: 201,
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
