import React from 'react';
import DOMPurify from 'dompurify';
import { WarningIcon } from './Icons';

interface StructuredResponseProps {
  content: string;
}

const StructuredResponse: React.FC<StructuredResponseProps> = ({ content }) => {
  if (!content || typeof content !== 'string') {
    return <p className="text-gray-500">No content available.</p>;
  }

  // --- Utility: Inline Markdown parsing with sanitization ---
  const parseInlineMarkdown = (text: string): string => {
    if (!text) return '';
    // Process in order: code, bold, italic
    const parsed = text
      .replace(/`(.*?)`/g, '<code class="bg-gray-200 text-red-600 px-1 py-0.5 rounded-sm font-mono text-sm">$1</code>') // Code
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>');              // Italic
    return DOMPurify.sanitize(parsed, { USE_PROFILES: { html: true } });
  };

  // --- Component: Code Block Renderer ---
  const renderCodeBlock = (codeBlock: string, key: string | number) => {
    const languageMatch = codeBlock.match(/^```(\w*)\n/);
    const language = languageMatch ? languageMatch[1] : '';
    const code = codeBlock.replace(/^```[\w-]*\n?/, '').replace(/```$/, '').trim();
    return (
      <div key={key} className="relative bg-gray-800 text-white p-4 rounded-md my-3 text-sm">
        {language && <span className="absolute top-2 right-2 text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">{language}</span>}
        <pre className="overflow-x-auto font-mono">
          <code>{code}</code>
        </pre>
      </div>
    );
  };

  // --- Component: Table Renderer ---
  const renderTable = (tableString: string, key: string | number) => {
    const rows = tableString.trim().split('\n').filter(r => r.trim());
    if (rows.length < 2) return <p key={key} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(tableString) }} />;

    const headers = rows[0].split('|').map(c => c.trim()).filter(Boolean);
    const bodyRows = rows
      .slice(1)
      .filter(r => !/^[-|: ]+$/.test(r)) // Skip markdown divider row
      .map(r => r.split('|').map(c => c.trim()));

    return (
      <div key={key} className="overflow-x-auto my-3 border border-gray-300 rounded-md">
        <table className="min-w-full bg-white text-sm">
          <thead className="bg-gray-100">
            <tr>
              {headers.map((header, i) => (
                <th key={i} className="py-2 px-4 border-b border-gray-300 text-left font-semibold text-gray-700">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 border-t border-gray-200">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="py-2 px-4 text-gray-800"
                    dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(cell) }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // --- Component: List Renderer (Handles nested lists) ---
  const renderList = (listString: string, key: string | number) => {
    const listItems = listString.split('\n').filter(Boolean);

    type ProcessedItem = { content: string; indentLevel: number };
    const processedItems: ProcessedItem[] = listItems.map(item => {
      const indent = item.match(/^(\s*)/)?.[1].length ?? 0;
      const content = item.replace(/^(\s*[-*+]\s+)/, '');
      // Common practice is 2 or 4 spaces per indent level. This is a robust way to handle both.
      return { content, indentLevel: Math.floor(indent / 2) };
    });

    const buildListRecursively = (items: ProcessedItem[], currentLevel = 0): [React.ReactElement[], number] => {
      const result: React.ReactElement[] = [];
      let i = 0;

      while (i < items.length) {
        const item = items[i];
        if (item.indentLevel < currentLevel) {
          break; // Return to parent level
        }

        if (item.indentLevel > currentLevel) {
          // This case should be handled by the recursive call, but as a fallback, we skip.
          i++;
          continue;
        }

        // It's an item at the current level.
        const [children, consumedCount] = buildListRecursively(items.slice(i + 1), currentLevel + 1);
        
        result.push(
          <li key={`${currentLevel}-${i}`}>
            <span dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(item.content) }} />
            {children.length > 0 && (
              <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                {children}
              </ul>
            )}
          </li>
        );
        i += 1 + consumedCount; // Move past the current item and all its children
      }

      return [result, i]; // Return the generated elements and how many items were consumed
    };
    
    const [listElements] = buildListRecursively(processedItems);

    return <ul key={key} className="list-disc list-inside space-y-1 my-2">{listElements}</ul>;
  };
  
  // --- Component: Body Renderer (Handles mixed content) ---
  const renderBody = (body: string) => {
    if (!body.trim()) return null;

    // 1. Split content by code blocks to isolate them.
    const parts = body.split(/(```[\s\S]*?```)/g);

    const elements = parts.map((part, index) => {
      if (!part.trim()) return null;

      if (part.startsWith('```') && part.endsWith('```')) {
        // This is a code block
        return renderCodeBlock(part, `code-${index}`);
      } else {
        // This is regular text, which might contain tables, lists, or paragraphs.
        // Split by double newlines to get blocks.
        const blocks = part.trim().split(/\n\s*\n/);
        return blocks.map((block, blockIndex) => {
          if (/\|.*\|/.test(block) && block.includes('---')) {
            return renderTable(block, `table-${index}-${blockIndex}`);
          }
          if (/^(\s*[-*+]\s+)/.test(block)) {
            return renderList(block, `list-${index}-${blockIndex}`);
          }
          return (
             <p
              key={`p-${index}-${blockIndex}`}
              dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(block) }}
              className="leading-relaxed text-gray-800"
            />
          );
        });
      }
    }).flat().filter(Boolean);

    return <div className="space-y-3 mt-1">{elements}</div>;
  };

  // --- Main Rendering Logic ---
  // 1. Split the entire content into sections based on Markdown headings.
  const sections = content.split(/\n(?=#+\s)/).map(s => s.trim()).filter(Boolean);

  const parseSection = (sectionText: string) => {
    const match = sectionText.match(/^(\#{1,6})\s+(.+)/);
    if (!match) {
      // Handle content that doesn't start with a heading
      return { title: '', body: sectionText.trim(), isWarning: false };
    }

    const title = match[2].trim();
    const body = sectionText.substring(match[0].length).trim();
    const isWarning = /အထူးသတိပေးချက်|⚠️/i.test(title);

    return { title, body, isWarning };
  };

  return (
    <div className="space-y-6">
      {sections.map((section, i) => {
        const { title, body, isWarning } = parseSection(section);
        if (!title && !body) return null;

        if (isWarning) {
          return (
            <div
              key={i}
              role="alert"
              aria-label="Warning"
              className="p-4 bg-red-50 border-l-4 border-red-500 text-red-900 rounded-r-md"
            >
              <div className="flex items-start">
                <WarningIcon className="w-5 h-5 mr-3 mt-0.5 text-red-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-base mb-1">{title.replace('⚠️', '').trim()}</h3>
                  {renderBody(body)}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={i}>
            <h3 className="font-bold text-gray-900 mb-1 text-base">{title}</h3>
            {renderBody(body)}
          </div>
        );
      })}
    </div>
  );
};

export default StructuredResponse;
