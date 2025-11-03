import React from 'react';
import { BotIcon } from './Icons';

interface ProcessingIndicatorProps {
    message: string;
}

const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({ message }) => {
    return (
        <div className="flex justify-start items-start gap-3 my-4">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white flex-shrink-0">
                <BotIcon />
            </div>
            <div className="bg-gray-200 p-4 rounded-lg max-w-lg flex items-center gap-3">
                <div className="flex items-end space-x-1.5 h-4">
                    <div className="w-2.5 h-2.5 bg-gray-600 rounded-full animate-bounce-dot-1"></div>
                    <div className="w-2.5 h-2.5 bg-gray-600 rounded-full animate-bounce-dot-2"></div>
                    <div className="w-2.5 h-2.5 bg-gray-600 rounded-full animate-bounce-dot-3"></div>
                </div>
                <span className="text-gray-700">{message}</span>
            </div>
        </div>
    );
};

export default ProcessingIndicator;