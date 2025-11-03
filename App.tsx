import React, { useState, useRef, useEffect } from 'react';
import { generateQuestionOrResponse, generateFinalResponse } from './services/geminiService';
import { ChatMessage, DisplayMessage, InteractionStage, Question, Answer } from './types';
import { BotIcon, SendIcon, UserIcon } from './components/Icons';
import LoadingSpinner from './components/LoadingSpinner';
import StructuredResponse from './components/StructuredResponse';

const App: React.FC = () => {
    const [stage, setStage] = useState<InteractionStage>(InteractionStage.INITIAL);
    const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
    const [userInput, setUserInput] = useState<string>('');
    const [initialQuery, setInitialQuery] = useState<string>('');
    const [answers, setAnswers] = useState<Answer[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [displayMessages]);

    const handleInitialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim()) return;

        setInitialQuery(userInput);
        const userMessage: DisplayMessage = { type: 'user', text: userInput };
        setDisplayMessages([userMessage]);
        setStage(InteractionStage.QUESTIONING);
        setUserInput('');
        
        try {
            const firstQuestion = await generateQuestionOrResponse([{ role: 'user', parts: [{ text: userInput }] }]);

            if (firstQuestion && 'question' in firstQuestion) {
                 const introMessage: DisplayMessage = {
                    type: 'model-intro',
                    text: 'မင်္ဂလာပါခင်ဗျာ။ သင့်အတွက် ဘေးအန္တရာယ်ကင်းပြီး အသင့်တော်ဆုံးဖြစ်မယ့် အကြံဉာဏ်ကိုပေးနိုင်ဖို့ မေးခွန်းလေးတွေ အရင်မေးပါရစေ။'
                };
                const questionMessage: DisplayMessage = { type: 'model-question', question: firstQuestion.question };
                setDisplayMessages(prev => [...prev, introMessage, questionMessage]);
            } else {
                throw new Error("Failed to get initial question.");
            }
        } catch (error) {
            console.error(error);
            setStage(InteractionStage.ERROR);
            const errorMessage: DisplayMessage = { type: 'model-error', text: 'တောင်းပန်ပါတယ်၊ အမှားအယွင်းတစ်ခုဖြစ်သွားပါတယ်။ ခဏနေပြီးမှ ပြန်ကြိုးစားပေးပါ။' };
            setDisplayMessages(prev => [...prev, errorMessage]);
        }
    };

    const handleAnswerSelect = async (question: Question, selectedOption: { key: string; value: string }) => {
        const newAnswer: Answer = { question: question.title, answer: selectedOption.value };
        const newAnswers = [...answers, newAnswer];
        setAnswers(newAnswers);

        const userAnswerDisplay: DisplayMessage = { type: 'user-answer', answer: selectedOption.value };
        setStage(InteractionStage.QUESTIONING);
        setDisplayMessages(prev => [...prev, userAnswerDisplay]);

        try {
            const chatHistory: ChatMessage[] = [
                { role: 'user', parts: [{ text: initialQuery }] },
                ...newAnswers.map(a => ({ role: 'user' as const, parts: [{ text: `For the question "${a.question}", my answer is "${a.answer}".` }] }))
            ];
            
            const nextStep = await generateQuestionOrResponse(chatHistory);

            if (nextStep && 'action' in nextStep && nextStep.action === 'generate_final_response') {
                setStage(InteractionStage.GENERATING_FINAL_RESPONSE);
                const finalResponseText = await generateFinalResponse(initialQuery, newAnswers);
                const finalResponse: DisplayMessage = { type: 'model-response', content: finalResponseText };
                setDisplayMessages(prev => [...prev, finalResponse]);
                setStage(InteractionStage.COMPLETE);
            } else if (nextStep && 'question' in nextStep) {
                const nextQuestion: DisplayMessage = { type: 'model-question', question: nextStep.question };
                setDisplayMessages(prev => [...prev, nextQuestion]);
            } else {
                 throw new Error("Unexpected response from AI.");
            }
        } catch (error) {
            console.error(error);
            setStage(InteractionStage.ERROR);
            const errorMessage: DisplayMessage = { type: 'model-error', text: 'တောင်းပန်ပါတယ်၊ အမှားအယွင်းတစ်ခုဖြစ်သွားပါတယ်။ ခဏနေပြီးမှ ပြန်ကြိုးစားပေးပါ။' };
            setDisplayMessages(prev => [...prev, errorMessage]);
        }
    };

    const handleRestart = () => {
        setStage(InteractionStage.INITIAL);
        setDisplayMessages([]);
        setUserInput('');
        setInitialQuery('');
        setAnswers([]);
    };

    const renderMessage = (msg: DisplayMessage, index: number) => {
        switch (msg.type) {
            case 'user':
            case 'user-answer':
                return (
                    <div key={index} className="flex justify-end items-start gap-3 my-4">
                        <div className="bg-blue-500 text-white p-3 rounded-lg max-w-lg">
                            <p>{msg.type === 'user' ? msg.text : msg.answer}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 flex-shrink-0">
                            <UserIcon />
                        </div>
                    </div>
                );
            case 'model-intro':
            case 'model-error':
                return (
                     <div key={index} className="flex justify-start items-start gap-3 my-4">
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white flex-shrink-0">
                            <BotIcon />
                        </div>
                        <div className="bg-gray-200 text-gray-800 p-3 rounded-lg max-w-lg">
                            <p>{msg.text}</p>
                        </div>
                    </div>
                );
            case 'model-question':
                const isCurrentQuestion = index === displayMessages.length - 1 && stage === InteractionStage.QUESTIONING;
                return (
                    <div key={index} className="flex justify-start items-start gap-3 my-4">
                         <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white flex-shrink-0">
                            <BotIcon />
                        </div>
                        <div className="bg-gray-200 p-4 rounded-lg w-full max-w-lg">
                            <h3 className="font-bold text-lg mb-1">{msg.question.title}</h3>
                            <p className="text-gray-600 mb-3">{msg.question.instruction}</p>
                            <div className="flex flex-col gap-2">
                                {msg.question.options.map(opt => (
                                    <button
                                        key={opt.key}
                                        onClick={() => handleAnswerSelect(msg.question, opt)}
                                        disabled={!isCurrentQuestion}
                                        className={`w-full text-left p-3 rounded-md border transition-colors ${
                                            isCurrentQuestion 
                                            ? 'bg-white hover:bg-blue-50 border-gray-300 hover:border-blue-400 cursor-pointer' 
                                            : 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                                        }`}
                                    >
                                        <span className="font-semibold mr-2">{opt.key}.</span>{opt.value}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case 'model-response':
                return (
                     <div key={index} className="flex justify-start items-start gap-3 my-4">
                         <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white flex-shrink-0">
                            <BotIcon />
                        </div>
                        <div className="bg-gray-200 text-gray-800 p-4 rounded-lg w-full max-w-lg prose prose-sm">
                           <StructuredResponse content={msg.content} />
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="bg-gray-100 h-screen flex flex-col font-sans">
            <header className="bg-white shadow-md p-4">
                <h1 className="text-2xl font-bold text-gray-800 text-center">Saya Chit - AI ဆေးဝါးလက်ထောက်</h1>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                 <div className="max-w-3xl mx-auto">
                    {displayMessages.length === 0 && (
                        <div className="text-center p-8 bg-white rounded-lg shadow">
                            <div className="mx-auto w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white mb-4">
                                <BotIcon className="w-8 h-8"/>
                            </div>
                            <h2 className="text-xl font-bold text-gray-700">မင်္ဂလာပါခင်ဗျာ။ ကျွန်တော်က Saya Chit ပါ။</h2>
                            <p className="text-gray-600 mt-2">သင့်ရဲ့ ရောဂါလက္ခဏာတွေကို ပြောပြပြီး ဆေးဝါးဆိုင်ရာ အကြံဉာဏ်တွေ ရယူနိုင်ပါတယ်။</p>
                        </div>
                    )}
                    {displayMessages.map(renderMessage)}
                    
                    {(stage === InteractionStage.QUESTIONING || stage === InteractionStage.GENERATING_FINAL_RESPONSE) && displayMessages[displayMessages.length -1]?.type !== 'model-error' && (
                       <div className="flex justify-start items-start gap-3 my-4">
                           <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white flex-shrink-0">
                               <BotIcon />
                           </div>
                           <div className="bg-gray-200 p-4 rounded-lg max-w-lg flex items-center gap-2">
                               <LoadingSpinner />
                               <span className="text-gray-700">အချက်အလက်များကို စီစစ်နေပါသည်...</span>
                           </div>
                       </div>
                    )}
                     <div ref={chatEndRef} />
                </div>
            </main>
            <footer className="bg-white border-t p-4">
                <div className="max-w-3xl mx-auto">
                    {stage === InteractionStage.INITIAL && (
                        <form onSubmit={handleInitialSubmit} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder="ဥပမာ - ခေါင်းကိုက်နေလို့ ဘာဆေးသောက်ရမလဲ။"
                                className="flex-1 p-3 border rounded-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            <button type="submit" className="bg-blue-500 text-white rounded-full p-3 hover:bg-blue-600 transition-colors disabled:bg-gray-400">
                                <SendIcon />
                            </button>
                        </form>
                    )}
                     {(stage === InteractionStage.COMPLETE || stage === InteractionStage.ERROR) && (
                        <div className="text-center">
                            <button 
                                onClick={handleRestart}
                                className="bg-green-600 text-white font-bold py-2 px-6 rounded-full hover:bg-green-700 transition-colors"
                            >
                                အစမှပြန်စရန်
                            </button>
                        </div>
                    )}
                </div>
            </footer>
        </div>
    );
};

export default App;