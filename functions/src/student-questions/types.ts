export interface StudentQuestionConfig { readonly questionCount: number; readonly englishQuestionsOnly: boolean }
export interface StudentQuestionDraft { readonly question: string; readonly referenceAnswer: string }
export interface AuthoringHelpInput { readonly roomId: string; readonly runId: string; readonly message: string; readonly interactionCount: number; readonly helpLevel: number }
export interface AuthoringHelpReply { readonly hint: string; readonly helpLevel: number }
