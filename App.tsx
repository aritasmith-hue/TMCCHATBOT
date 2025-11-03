import React, { useState, useRef, useEffect } from 'react';
import { generateQuestionOrResponse, generateFinalResponse } from './services/geminiService';
import { getConversations, saveConversation, clearHistory } from './services/historyService';
import { ChatMessage, DisplayMessage, InteractionStage, Question, Answer, Conversation } from './types';
import { BotIcon, SendIcon, UserIcon, HistoryIcon, EditIcon, WarningIcon } from './components/Icons';
import ProcessingIndicator from './components/ProcessingIndicator';
import StructuredResponse from './components/StructuredResponse';
import HistoryModal from './components/HistoryModal';

const App: React.FC = () => {
    const [stage, setStage] = useState<InteractionStage>(InteractionStage.INITIAL);
    const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
    const [userInput, setUserInput] = useState<string>('');
    const [initialQuery, setInitialQuery] = useState<string>('');
    const [answers, setAnswers] = useState<Answer[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [viewingHistory, setViewingHistory] = useState(false);
    const [isEditingQuery, setIsEditingQuery] = useState(false);
    const [editedQueryText, setEditedQueryText] = useState('');
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
        setCurrentConversationId(Date.now().toString());
        setViewingHistory(false);
        setAnswers([]); // Ensure answers are cleared for a new conversation
        
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
            const message = error instanceof Error ? error.message : 'တောင်းပန်ပါတယ်၊ အမှားအယွင်းတစ်ခုဖြစ်သွားပါတယ်။ ခဏနေပြီးမှ ပြန်ကြိုးစားပေးပါ။';
            const errorMessage: DisplayMessage = { type: 'model-error', text: message };
            setDisplayMessages(prev => [...prev, errorMessage]);
        }
    };

    const handleAnswerSelect = async (question: Question, selectedOption: { key: string; value: string }) => {
        const userAnswerDisplay: DisplayMessage = { type: 'user-answer', answer: selectedOption.value };
        const currentMessages = [...displayMessages, userAnswerDisplay];
        setDisplayMessages(currentMessages);
        setStage(InteractionStage.QUESTIONING);

        const newAnswer: Answer = { question: question.title, answer: selectedOption.value };
        const newAnswers = [...answers, newAnswer];
        setAnswers(newAnswers);

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
                
                const finalMessages = [...currentMessages, finalResponse];

                if (currentConversationId) {
                    const conversationToSave: Conversation = {
                        id: currentConversationId,
                        timestamp: Date.now(),
                        initialQuery,
                        answers: newAnswers,
                        displayMessages: finalMessages,
                    };
                    saveConversation(conversationToSave);
                }

                setDisplayMessages(finalMessages);
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
            const message = error instanceof Error ? error.message : 'တောင်းပန်ပါတယ်၊ အမှားအယွင်းတစ်ခုဖြစ်သွားပါတယ်။ ခဏနေပြီးမှ ပြန်ကြိုးစားပေးပါ။';
            const errorMessage: DisplayMessage = { type: 'model-error', text: message };
            setDisplayMessages(prev => [...prev, errorMessage]);
        }
    };

    const handleStartEditQuery = () => {
        setIsEditingQuery(true);
        setEditedQueryText(initialQuery);
    };

    const handleCancelEditQuery = () => {
        setIsEditingQuery(false);
        setEditedQueryText('');
    };

    const handleSaveQuery = async (e: React.FormEvent) => {
        e.preventDefault();
        const newQuery = editedQueryText.trim();
        if (!newQuery) return;

        setInitialQuery(newQuery);
        const userMessage: DisplayMessage = { type: 'user', text: newQuery };
        // Reset conversation to the new query
        setDisplayMessages([userMessage]);
        setAnswers([]);
        setStage(InteractionStage.QUESTIONING);
        setIsEditingQuery(false);
        setEditedQueryText('');

        try {
            const firstQuestion = await generateQuestionOrResponse([{ role: 'user', parts: [{ text: newQuery }] }]);
            if (firstQuestion && 'question' in firstQuestion) {
                const introMessage: DisplayMessage = {
                    type: 'model-intro',
                    text: 'မင်္ဂလာပါခင်ဗျာ။ သင့်အတွက် ဘေးအန္တရာယ်ကင်းပြီး အသင့်တော်ဆုံးဖြစ်မယ့် အကြံဉာဏ်ကိုပေးနိုင်ဖို့ မေးခွန်းလေးတွေ အရင်မေးပါရစေ။'
                };
                const questionMessage: DisplayMessage = { type: 'model-question', question: firstQuestion.question };
                setDisplayMessages(prev => [...prev, introMessage, questionMessage]);
            } else {
                throw new Error("Failed to get initial question after edit.");
            }
        } catch (error) {
            console.error("Error after editing query:", error);
            setStage(InteractionStage.ERROR);
            const message = error instanceof Error ? error.message : 'တောင်းပန်ပါတယ်၊ အမှားအယွင်းတစ်ခုဖြစ်သွားပါတယ်။ ခဏနေပြီးမှ ပြန်ကြိုးစားပေးပါ။';
            const errorMessage: DisplayMessage = { type: 'model-error', text: message };
            setDisplayMessages(prev => [...prev, errorMessage]);
        }
    };

    const handleRestart = () => {
        setStage(InteractionStage.INITIAL);
        setDisplayMessages([]);
        setUserInput('');
        setInitialQuery('');
        setAnswers([]);
        setCurrentConversationId(null);
        setViewingHistory(false);
        setIsEditingQuery(false);
    };

    const loadConversation = (conversation: Conversation) => {
        // Set state based on the loaded conversation
        setInitialQuery(conversation.initialQuery);
        setAnswers(conversation.answers);
        setDisplayMessages(conversation.displayMessages);
        setCurrentConversationId(conversation.id);
        
        // Set the app's mode to reflect that we are viewing a completed, historical conversation
        setStage(InteractionStage.COMPLETE);
        setViewingHistory(true);

        // Reset any transient UI states
        setUserInput('');
        setIsEditingQuery(false);
        setEditedQueryText('');
        
        // Close the history modal
        setIsHistoryOpen(false);
    };


    const renderMessage = (msg: DisplayMessage, index: number) => {
        switch (msg.type) {
            case 'user':
                const showEditButton = index === 0 && displayMessages.length === 3 && stage === InteractionStage.QUESTIONING && !viewingHistory && !isEditingQuery;
                if (index === 0 && isEditingQuery) {
                    return (
                        <div key={`${index}-edit`} className="flex justify-end items-start gap-3 my-4">
                             <form onSubmit={handleSaveQuery} className="bg-blue-500 p-3 rounded-lg max-w-lg w-full">
                                <textarea
                                    value={editedQueryText}
                                    onChange={(e) => setEditedQueryText(e.target.value)}
                                    className="w-full p-2 border rounded-md text-gray-800 resize-none"
                                    rows={2}
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                    <button type="button" onClick={handleCancelEditQuery} className="text-sm bg-gray-200 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-300">မပြင်တော့ပါ</button>
                                    <button type="submit" className="text-sm bg-white text-blue-600 font-semibold px-3 py-1 rounded-md hover:bg-blue-50">သိမ်းမည်</button>
                                </div>
                            </form>
                            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 flex-shrink-0">
                                <UserIcon />
                            </div>
                        </div>
                    )
                }
                return (
                    <div key={index} className="flex justify-end items-start gap-3 my-4 group">
                        <div className="bg-blue-500 text-white p-3 rounded-lg max-w-lg relative">
                            <p>{msg.text}</p>
                            {showEditButton && (
                                <button onClick={handleStartEditQuery} className="absolute -left-8 top-1/2 -translate-y-1/2 p-1 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Edit query">
                                    <EditIcon className="w-4 h-4 text-gray-600" />
                                </button>
                            )}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 flex-shrink-0">
                            <UserIcon />
                        </div>
                    </div>
                );
            case 'user-answer':
                return (
                    <div key={index} className="flex justify-end items-start gap-3 my-4">
                        <div className="bg-blue-500 text-white p-3 rounded-lg max-w-lg">
                            <p>{msg.answer}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 flex-shrink-0">
                            <UserIcon />
                        </div>
                    </div>
                );
            case 'model-intro':
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
            case 'model-error':
                return (
                     <div key={index} className="flex justify-start items-start gap-3 my-4">
                        <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white flex-shrink-0">
                            <WarningIcon className="w-5 h-5" />
                        </div>
                        <div className="bg-red-50 text-red-900 p-3 rounded-lg max-w-lg">
                            <p className="font-bold mb-1">အမှားအယွင်း</p>
                            <p>{msg.text}</p>
                        </div>
                    </div>
                );
            case 'model-question':
                const isCurrentQuestion = index === displayMessages.length - 1 && stage === InteractionStage.QUESTIONING;
                const isButtonActive = isCurrentQuestion && !isEditingQuery && !viewingHistory;
                return (
                    <div key={index} className="flex justify-start items-start gap-3 my-4">
                         <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white flex-shrink-0">
                            <BotIcon />
                        </div>
                        <div className={`bg-gray-200 p-4 rounded-lg w-full max-w-lg ${isEditingQuery ? 'opacity-50' : ''}`}>
                            <h3 className="font-bold text-lg mb-1">{msg.question.title}</h3>
                            <p className="text-gray-600 mb-3">{msg.question.instruction}</p>
                            <div className="flex flex-col gap-2">
                                {msg.question.options.map(opt => (
                                    <button
                                        key={opt.key}
                                        onClick={() => handleAnswerSelect(msg.question, opt)}
                                        disabled={!isButtonActive}
                                        className={`w-full text-left p-3 rounded-md border transition-colors ${
                                            isButtonActive
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

    const isLoading = (stage === InteractionStage.QUESTIONING || stage === InteractionStage.GENERATING_FINAL_RESPONSE) && displayMessages[displayMessages.length - 1]?.type !== 'model-error' && !isEditingQuery;

    let loadingMessage = '';
    if (isLoading) {
        if (stage === InteractionStage.GENERATING_FINAL_RESPONSE) {
            loadingMessage = "အချက်အလက်များ ပြည့်စုံပြီဖြစ်၍ သင့်အတွက် အကြံပြုချက်ကို ပြင်ဆင်နေပါသည်...";
        } else if (stage === InteractionStage.QUESTIONING) {
            const lastMessage = displayMessages[displayMessages.length - 1];
            if (lastMessage?.type === 'user') {
                loadingMessage = "သင်၏ မေးခွန်းကို နားလည်အောင် ကြိုးစားနေပါသည်...";
            } else if (lastMessage?.type === 'user-answer') {
                loadingMessage = "သင်၏ အဖြေကို စီစစ်သုံးသပ်နေပါသည်...";
            } else {
                loadingMessage = "ခေတ္တစောင့်ဆိုင်းပေးပါ..."; // Fallback
            }
        }
    }

    return (
        <>
            <HistoryModal 
                isOpen={isHistoryOpen} 
                onClose={() => setIsHistoryOpen(false)} 
                onLoadConversation={loadConversation}
            />
            <div className="bg-gray-100 h-screen flex flex-col font-sans">
                <header className="bg-white shadow-md p-4 flex items-center justify-between">
                    <div className="w-10"></div> {/* Spacer */}
                    <h1 className="text-2xl font-bold text-gray-800 text-center">Saya Chit - AI ဆေးဝါးလက်ထောက်</h1>
                    <button 
                        onClick={() => setIsHistoryOpen(true)}
                        className="text-gray-600 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
                        aria-label="View conversation history"
                    >
                        <HistoryIcon />
                    </button>
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
                                <div className="mt-8 text-left max-w-md mx-auto">
                                    <p className="text-sm text-gray-500 mb-3 text-center">စတင်ရန် ဥပမာတစ်ခုကို ရွေးပါ သို့မဟုတ် သင့်မေးခွန်းကို ရိုက်ထည့်ပါ။</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <button onClick={() => setUserInput('ခေါင်းကိုက်ပြီး နှာစေးနေတယ်။')} className="text-sm text-gray-700 font-medium text-left p-3 bg-gray-100 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 hover:border-blue-300">ခေါင်းကိုက်ခြင်း၊ နှာစေးခြင်း</button>
                                        <button onClick={() => setUserInput('အစာမကြေဖြစ်ပြီး ဗိုက်အောင့်နေတယ်။')} className="text-sm text-gray-700 font-medium text-left p-3 bg-gray-100 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 hover:border-blue-300">အစာမကြေခြင်း၊ ဗိုက်အောင့်ခြင်း</button>
                                        <button onClick={() => setUserInput('အရေပြားမှာ ယားပြီး အနီကွက်တွေထွက်နေတယ်။')} className="text-sm text-gray-700 font-medium text-left p-3 bg-gray-100 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 hover:border-blue-300">အရေပြား ယားယံခြင်း</button>
                                        <button onClick={() => setUserInput('ချောင်းခြောက်ဆိုးနေတာ တစ်ပတ်ရှိပြီ။')} className="text-sm text-gray-700 font-medium text-left p-3 bg-gray-100 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 hover:border-blue-300">နာတာရှည် ချောင်းဆိုးခြင်း</button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {displayMessages.map(renderMessage)}
                        
                        {isLoading && <ProcessingIndicator message={loadingMessage} />}

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
                                <button type="submit" disabled={!userInput.trim()} className="bg-blue-500 text-white rounded-full p-3 hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">
                                    <SendIcon />
                                </button>
                            </form>
                        )}
                        {(stage === InteractionStage.COMPLETE || stage === InteractionStage.ERROR) && !isEditingQuery && (
                            <div className="text-center">
                                <button 
                                    onClick={handleRestart}
                                    className="bg-green-600 text-white font-bold py-2 px-6 rounded-full hover:bg-green-700 transition-colors"
                                >
                                    {viewingHistory ? 'စကားဝိုင်းအသစ် စတင်ရန်' : 'အစမှပြန်စရန်'}
                                </button>
                            </div>
                        )}
                        <p className="text-xs text-gray-500 text-center mt-3 px-4">
                           Saya Chit သည် AI လက်ထောက်သာဖြစ်ပြီး ဆေးဘက်ဆိုင်ရာ ကျွမ်းကျင်သူမဟုတ်ပါ။ အရေးပေါ်အခြေအနေများအတွက် ဆရာဝန်နှင့် ချက်ချင်းတိုင်ပင်ပါ။
                        </p>
                    </div>
                </footer>
            </div>
        </>
    );
};

export default App;