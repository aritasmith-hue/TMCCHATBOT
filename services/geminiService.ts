import { GoogleGenAI, Type } from "@google/genai";
import { SAYA_PERSONA_PROMPT, FINAL_RESPONSE_PROMPT } from '../constants';
import { Answer, ChatMessage, Question } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const questionResponseSchema = {
    type: Type.OBJECT,
    properties: {
        action: {
            type: Type.STRING,
            description: "Set to 'generate_final_response' when enough information is gathered, otherwise omit this field.",
            nullable: true,
        },
        question: {
            type: Type.OBJECT,
            description: "The question to ask the user. Omit if action is 'generate_final_response'.",
            nullable: true,
            properties: {
                title: { type: Type.STRING },
                instruction: { type: Type.STRING, description: "e.g., '(အဖြေတစ်ခုသာ ရွေးချယ်ပါ)'" },
                options: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            key: { type: Type.STRING, description: "e.g., 'A', 'B', 'C'"},
                            value: { type: Type.STRING }
                        },
                        required: ["key", "value"]
                    }
                }
            },
            required: ["title", "instruction", "options"]
        }
    }
};

function handleApiError(error: unknown, context: string): never {
    console.error(`Error during ${context}:`, error);

    let userMessage = 'တောင်းပန်ပါတယ်၊ အမှားအယွင်းတစ်ခုဖြစ်သွားပါတယ်။ ခဏနေပြီးမှ ပြန်ကြိုးစားပေးပါ။'; // Default message

    if (error instanceof Error) {
        const lowerCaseMessage = error.message.toLowerCase();
        
        if (lowerCaseMessage.includes('api key not valid')) {
            userMessage = 'API Key မမှန်ကန်ပါ။ သင်၏ API Key ကို ပြန်လည်စစ်ဆေးပေးပါ။';
        } else if (lowerCaseMessage.includes('network') || lowerCaseMessage.includes('failed to fetch')) {
            userMessage = 'အင်တာနက်ချိတ်ဆက်မှု မကောင်းပါ။ ကျေးဇူးပြု၍ ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်မံကြိုးစားပါ။';
        } else if (lowerCaseMessage.includes('500') || lowerCaseMessage.includes('503') || lowerCaseMessage.includes('server error')) {
            userMessage = 'AI ဆာဗာတွင် ယာယီပြဿနာတစ်ခု ရှိနေပါသည်။ ခဏအကြာတွင် ထပ်မံကြိုးစားကြည့်ပါ။';
        } else if (lowerCaseMessage.includes('resource has been exhausted') || lowerCaseMessage.includes('rate limit')) {
             userMessage = 'တောင်းဆိုမှုများ အလွန်များနေပါသည်။ ခဏအကြာတွင် ထပ်မံကြိုးစားကြည့်ပါ။';
        } else if (lowerCaseMessage.includes('candidate') && lowerCaseMessage.includes('blocked')) {
            userMessage = 'မသင့်လျော်သော အကြောင်းအရာကြောင့် တောင်းဆိုမှုကို ပယ်ချခဲ့ပါသည်။ ကျေးဇူးပြု၍ သင်၏ မေးခွန်းကို ပြန်လည်စစ်ဆေးပါ။';
        }
    }
    
    throw new Error(userMessage);
}

export async function generateQuestionOrResponse(history: ChatMessage[]): Promise<{ question: Question } | { action: 'generate_final_response' } | null> {
    const model = 'gemini-2.5-flash';

    const fullHistory: ChatMessage[] = [];
    if(history.length > 0) {
        // We only add the persona prompt after the first user message
        fullHistory.push({ role: 'user', parts: [{ text: SAYA_PERSONA_PROMPT }]});
        fullHistory.push({ role: 'model', parts: [{ text: "ဟုတ်ကဲ့၊ ကျွန်တော် Saya Chit ပါ။ ဘေးအန္တရာယ်ကင်းရှင်းရေးအတွက် မေးခွန်းများမေးရန် အသင့်ရှိပါတယ်။" }]});
    }
    fullHistory.push(...history);

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: fullHistory,
            config: {
                responseMimeType: "application/json",
                responseSchema: questionResponseSchema,
                temperature: 0.5,
            },
        });
        
        const jsonText = response.text.trim();
        if (jsonText) {
            // A simple guard against non-JSON responses which can happen on error.
            if (jsonText.startsWith('{') || jsonText.startsWith('[')) {
                return JSON.parse(jsonText);
            }
        }
        return null;
    } catch (error) {
        handleApiError(error, "question generation");
    }
}

export async function generateFinalResponse(initialQuery: string, answers: Answer[]): Promise<string> {
    const model = 'gemini-2.5-flash';
    
    const answersString = answers.map(a => `- ${a.question}: ${a.answer}`).join('\n');
    const prompt = FINAL_RESPONSE_PROMPT
        .replace('{initialQuery}', initialQuery)
        .replace('{answers}', answersString);

    const history: ChatMessage[] = [
        { role: 'user', parts: [{ text: SAYA_PERSONA_PROMPT }] },
        { role: 'model', parts: [{ text: "ဟုတ်ကဲ့၊ ကျွန်တော် Saya Chit ပါ။ အချက်အလက်များ ပြည့်စုံပြီဖြစ်သောကြောင့် ဘေးကင်းလုံခြုံသော အကြံပြုချက်ကို ပေးပါမည်။" }] },
        { role: 'user', parts: [{ text: prompt }] },
    ];

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: history,
            config: {
                temperature: 0.3,
            }
        });
        return response.text;
    } catch (error) {
        handleApiError(error, "final response generation");
    }
}