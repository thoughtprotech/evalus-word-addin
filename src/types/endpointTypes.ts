export interface APIResponse<T> {
    status: number;
    message: string;
    error: boolean;
    data?: T
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
