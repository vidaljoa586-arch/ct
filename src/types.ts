export interface Question {
  id: string;
  content: string;
  answer: string;
  analysis: string;
}

export interface WrongQuestionRecord {
  id: string;
  originalImage?: string;
  originalQuestion: Question;
  knowledgePoint: string;
  similarQuestions: Question[];
  createdAt: number;
}
