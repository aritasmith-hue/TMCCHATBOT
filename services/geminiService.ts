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

    // Default user-friendly error message in Burmese
    let userMessage = 'တောင်းပန်ပါသည်၊ မမျှော်လင့်ထားသော အမှားအယွင်းတစ်ခု ဖြစ်ပေါ်သွားပါသည်။ ခဏအကြာတွင် ထပ်မံကြိုးစားပေးပါ။';

    if (error instanceof Error) {
        const lowerCaseMessage = error.message.toLowerCase();
        
        // Check for specific error types based on keywords in the error message
        if (lowerCaseMessage.includes('api key not valid')) {
            // Invalid API Key
            userMessage = 'API Key မမှန်ကန်ပါ။ ကျေးဇူးပြု၍ API Key ကို ပြန်လည်စစ်ဆေးပြီး နောက်တစ်ကြိမ် ထပ်မံကြိုးစားပါ။';
        } else if (lowerCaseMessage.includes('network') || lowerCaseMessage.includes('failed to fetch')) {
            // Network connectivity issues
            userMessage = 'အင်တာနက်ချိတ်ဆက်မှု ပြတ်တောက်နေပါသည်။ ကျေးဇူးပြု၍ သင်၏ ကွန်ရက်ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်မံကြိုးစားပါ။';
        } else if (lowerCaseMessage.includes('500') || lowerCaseMessage.includes('503') || lowerCaseMessage.includes('server error')) {
            // Server-side errors from the API
            userMessage = 'AI ဆာဗာတွင် ယာယီပြဿနာတစ်ခု ဖြစ်ပေါ်နေပါသည်။ ခေတ္တစောင့်ဆိုင်းပြီး နောက်တစ်ကြိမ် ကြိုးစားပေးပါ။';
        } else if (lowerCaseMessage.includes('resource has been exhausted') || lowerCaseMessage.includes('rate limit')) {
            // Rate limiting or quota exceeded
            userMessage = 'တောင်းဆိုမှုများ အလွန်များပြားနေပါသဖြင့် ခေတ္တရပ်နားထားပါသည်။ ခဏအကြာတွင် ထပ်မံကြိုးစားပေးပါ။';
        } else if (lowerCaseMessage.includes('candidate') && lowerCaseMessage.includes('blocked')) {
            // Content blocked due to safety policies
            userMessage = 'သင်၏တောင်းဆိုမှုတွင် မူဝါဒနှင့်မကိုက်ညီသော အကြောင်းအရာ ပါဝင်နေသောကြောင့် တောင်းဆိုမှုကို ပယ်ချလိုက်ပါသည်။ ကျေးဇူးပြု၍ သင်၏ မေးခွန်းကို ပြန်လည်စစ်ဆေးပါ။';
        } else {
            // If none of the specific API errors match, but it's still an Error object,
            // it might be one of our custom-thrown errors. Use its message directly.
            userMessage = error.message;
        }
    }
    
    // Throw a new error with the user-friendly message, which will be caught and displayed by the UI
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

        const responseText = response.text;
        if (!responseText) {
            console.error("API returned an empty response for final generation. This may be due to content filtering.", response);
            throw new Error('AI မှ အကြောင်းပြန်ကြားချက် မရရှိပါ။ သင်၏ မေးမြန်းမှုတွင် ဘေးကင်းရေးမူဝါဒနှင့် မကိုက်ညီသော အကြောင်းအရာများ ပါဝင်နေနိုင်သောကြောင့် ဖြစ်ပါသည်။');
        }

        return responseText;
    } catch (error) {
        handleApiError(error, "final response generation");
    }
}