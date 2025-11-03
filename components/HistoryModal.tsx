import React, { useState, useEffect } from 'react';
import { Conversation } from '../types';
import { getConversations, clearHistory } from '../services/historyService';
import { TrashIcon } from './Icons';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadConversation: (conversation: Conversation) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, onLoadConversation }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);

    useEffect(() => {
        if (isOpen) {
            setConversations(getConversations());
        }
    }, [isOpen]);

    const handleClearHistory = () => {
        clearHistory();
        setConversations([]);
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <header className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-800">စကားဝိုင်း မှတ်တမ်း</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">&times;</button>
                </header>
                <main className="p-4 overflow-y-auto flex-1">
                    {conversations.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">မှတ်တမ်းများ မရှိသေးပါ။</p>
                    ) : (
                        <ul className="space-y-2">
                            {conversations.map(convo => (
                                <li key={convo.id}>
                                    <button 
                                        onClick={() => onLoadConversation(convo)}
                                        className="w-full text-left p-3 bg-gray-50 hover:bg-blue-50 border rounded-md transition-colors"
                                    >
                                        <p className="font-semibold text-gray-800 truncate">{convo.initialQuery}</p>
                                        <p className="text-xs text-gray-500 mt-1">{new Date(convo.timestamp).toLocaleString()}</p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </main>
                {conversations.length > 0 && (
                     <footer className="p-3 border-t text-right">
                        <button 
                            onClick={handleClearHistory}
                            className="text-sm text-red-600 hover:text-red-800 font-semibold px-3 py-1 rounded-md hover:bg-red-50 flex items-center gap-1.5 transition-colors"
                        >
                            <TrashIcon />
                            မှတ်တမ်းအားလုံးကိုဖျက်ရန်
                        </button>
                    </footer>
                )}
            </div>
        </div>
    );
};

export default HistoryModal;
