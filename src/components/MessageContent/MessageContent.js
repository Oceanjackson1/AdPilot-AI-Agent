'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dynamic from 'next/dynamic';
import styles from './MessageContent.module.css';

const ReactEChartsForReact = dynamic(() => import('echarts-for-react'), { ssr: false });

/**
 * Parse chart blocks from markdown content.
 * AI can embed charts using ```chart ... ``` code blocks with JSON config.
 */
function parseChartBlocks(content) {
    const parts = [];
    const chartRegex = /```chart\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = chartRegex.exec(content)) !== null) {
        // Text before chart
        if (match.index > lastIndex) {
            parts.push({ type: 'markdown', content: content.slice(lastIndex, match.index) });
        }
        // Chart block
        try {
            const chartConfig = JSON.parse(match[1].trim());
            parts.push({ type: 'chart', config: chartConfig });
        } catch {
            // If JSON parse fails, treat as regular code block
            parts.push({ type: 'markdown', content: match[0] });
        }
        lastIndex = match.index + match[0].length;
    }

    // Remaining text
    if (lastIndex < content.length) {
        parts.push({ type: 'markdown', content: content.slice(lastIndex) });
    }

    return parts.length > 0 ? parts : [{ type: 'markdown', content }];
}

function ChartBlock({ config }) {
    const defaultTheme = {
        color: ['#1D1D1F', '#86868B', '#34C759', '#FF9500', '#FF3B30', '#5AC8FA', '#AF52DE'],
        backgroundColor: 'transparent',
        textStyle: { fontFamily: 'Inter, -apple-system, sans-serif' },
    };

    const option = {
        ...config,
        backgroundColor: 'transparent',
        grid: { containLabel: true, left: 16, right: 16, top: 40, bottom: 16, ...config.grid },
    };

    return (
        <div className={styles.chartContainer}>
            <ReactEChartsForReact
                option={option}
                theme={defaultTheme}
                style={{ height: 320, width: '100%' }}
                opts={{ renderer: 'svg' }}
            />
        </div>
    );
}

export default function MessageContent({ content }) {
    const parts = parseChartBlocks(content);

    return (
        <div className={styles.messageContent}>
            {parts.map((part, i) => {
                if (part.type === 'chart') {
                    return <ChartBlock key={i} config={part.config} />;
                }
                return (
                    <ReactMarkdown
                        key={i}
                        remarkPlugins={[remarkGfm]}
                        components={{
                            table: ({ children }) => (
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>{children}</table>
                                </div>
                            ),
                            code: ({ inline, className, children, ...props }) => {
                                if (inline) {
                                    return <code className={styles.inlineCode} {...props}>{children}</code>;
                                }
                                return (
                                    <pre className={styles.codeBlock}>
                                        <code className={className} {...props}>{children}</code>
                                    </pre>
                                );
                            },
                        }}
                    >
                        {part.content}
                    </ReactMarkdown>
                );
            })}
        </div>
    );
}
