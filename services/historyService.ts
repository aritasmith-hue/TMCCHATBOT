import { Conversation } from '../types';

const HISTORY_KEY = 'sayaChitHistory';

export const getConversations = (): Conversation[] => {
    try {
        const storedHistory = localStorage.getItem(HISTORY_KEY);
        if (storedHistory) {
            const conversations: Conversation[] = JSON.parse(storedHistory);
            // Sort by timestamp descending to show newest first
            return conversations.sort((a, b) => b.timestamp - a.timestamp);
        }
        return [];
    } catch (error) {
        console.error("Failed to parse conversation history:", error);
        return [];
    }
};

export const saveConversation = (conversation: Conversation) => {
    try {
        const conversations = getConversations();
        const existingIndex = conversations.findIndex(c => c.id === conversation.id);

        if (existingIndex > -1) {
            // This case is unlikely with timestamp-based IDs but good for robustness
            conversations[existingIndex] = conversation;
        } else {
            conversations.push(conversation);
        }
        localStorage.setItem(HISTORY_KEY, JSON.stringify(conversations));
    } catch (error) {
        console.error("Failed to save conversation:", error);
    }
};

export const clearHistory = () => {
    try {
        localStorage.removeItem(HISTORY_KEY);
    } catch (error) {
        console.error("Failed to clear history:", error);
    }
};
