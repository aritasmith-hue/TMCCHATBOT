
export interface Question {
    title: string;
    instruction: string;
    options: { key: string; value: string }[];
}

export interface Answer {
    question: string;
    answer: string;
}

export enum InteractionStage {
    INITIAL,
    QUESTIONING,
    GENERATING_FINAL_RESPONSE,
    COMPLETE,
    ERROR
}

export type DisplayMessage =
    | { type: 'user'; text: string }
    | { type: 'user-answer'; answer: string }
    | { type: 'model-intro'; text: string }
    | { type: 'model-question'; question: Question }
    | { type: 'model-response'; content: string }
    | { type: 'model-error'; text: string };

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}
