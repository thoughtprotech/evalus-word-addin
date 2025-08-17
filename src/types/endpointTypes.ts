export interface APIResponse<T> {
  status: number;
  message: string;
  error: boolean;
  data?: T;
}

export interface PatternInterface {
  patternId: number;
  patternType: "question" | "option" | "solution" | "answer" | "writeup";
  patternText: string;
  language: string;
  isActive: boolean;
  createdBy: string;
  createdDate: string;
  modifiedBy: string;
  modifiedDate: string;
}

export interface GetSectionListInterface {
  testSectionId: number;
  testSectionName: string;
  isActive: number;
  createdBy: string;
  createdDate: string;
  language: string;
  modifiedBy: string;
  modifiedDate: string;
  sectionOrder: number;
  totalQuestions: number;
  totalMarks: number;
  minTimeDuration: number;
  maxTimeDuration: number;
  testQuestions: [];
  isCreateOperation: boolean;
  isUpdateOperation: boolean;
}

export interface GetTestListInterface {
  testTypeId: number;
  testType1: string;
  language: string;
  isActive: number;
  createdBy: string;
  createdDate: string;
  modifiedBy: string;
  modifiedDate: string;
}

export interface GetTestCategoryListInterface {
  testCategoryId: number;
  testCategoryName: string;
  testCategoryType: string;
  parentId: number;
  language: string;
  isActive: number;
  createdBy: string;
  createdDate: string;
  modifiedBy: string;
  modifiedDate: string;
}

export interface GetTestDifficultyInterface {
  testDifficultyLevelId: number;
  testDifficultyLevel1: string;
  language: string;
  isActive: number;
  createdBy: string;
  createdDate: string;
  modifiedBy: string;
  modifiedDate: string;
}

export interface GetTestInstructionsInterface {
  testInstructionId: number;
  testInstructionName: string;
  testInstruction1: string;
  language: string;
  isActive: number;
  createdBy: string;
  createdDate: string;
  modifiedBy: string;
  modifiedDate: string;
}
