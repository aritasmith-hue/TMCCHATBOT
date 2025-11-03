
import React from 'react';
import { WarningIcon } from './Icons';

interface StructuredResponseProps {
    content: string;
}

const StructuredResponse: React.FC<StructuredResponseProps> = ({ content }) => {
    const sections = content.split(/\n(?=#*\s)/).map(s => s.trim());

    const parseSection = (sectionText: string) => {
        const match = sectionText.match(/^(#+)\s(.+)/);
        if (!match) {
            return { title: '', body: sectionText, isWarning: false };
        }
        
        const title = match[2].trim();
        const body = sectionText.substring(match[0].length).trim();
        const isWarning = title.includes('အထူးသတိပေးချက်');

        return { title, body, isWarning };
    };
    
    const renderTable = (tableString: string) => {
        const rows = tableString.split('\n').map(row => row.replace(/^\||\|$/g, '').trim());
        if (rows.length < 2) return <p>{tableString}</p>; // Not a valid table
        
        const headerCells = rows[0].split('|').map(cell => cell.trim());
        const bodyRows = rows.slice(2).map(row => row.split('|').map(cell => cell.trim()));

        return (
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-300">
                    <thead className="bg-gray-100">
                        <tr>
                            {headerCells.map((header, i) => (
                                <th key={i} className="py-2 px-3 border-b text-left text-sm font-bold text-gray-600">{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {bodyRows.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                {row.map((cell, j) => (
                                    <td key={j} className="py-2 px-3 border-b text-sm text-gray-700">{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderBody = (title: string, body: string) => {
        if (title.includes('သောက်သုံးရန် ပမာဏ')) {
            return renderTable(body);
        }
        
        const lines = body.split('\n').filter(line => line.trim().length > 0);
        // Check if every non-empty line starts with a hyphen, indicating a list.
        const isList = lines.length > 0 && lines.every(line => line.trim().startsWith('-'));

        if (isList) {
            return (
                <ul className="list-disc list-inside space-y-1">
                    {lines.map((item, index) => (
                        // Remove the leading hyphen and trim whitespace
                        <li key={index}>{item.trim().substring(1).trim()}</li>
                    ))}
                </ul>
            );
        }
        
        // Default paragraph rendering, with bolding
        return <p dangerouslySetInnerHTML={{ __html: body.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />;
    };

    return (
        <div className="space-y-4">
            {sections.map((section, index) => {
                const { title, body, isWarning } = parseSection(section);
                if (!title) return null;

                if (isWarning) {
                    return (
                        <div key={index} className="p-3 bg-red-100 border-l-4 border-red-500 text-red-800 rounded-r-lg">
                            <div className="flex items-center">
                                <WarningIcon className="w-6 h-6 mr-2 text-red-600" />
                                <h3 className="font-bold text-base">{title.replace('⚠️', '').trim()}</h3>
                            </div>
                            <div className="mt-1 ml-8 text-sm">{renderBody(title, body)}</div>
                        </div>
                    );
                }
                
                return (
                     <div key={index}>
                        <h3 className="font-bold text-base mb-1">{title}</h3>
                        <div className="text-sm">{renderBody(title, body)}</div>
                    </div>
                );
            })}
        </div>
    );
};

export default StructuredResponse;
