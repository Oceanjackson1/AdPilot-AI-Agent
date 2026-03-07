'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/Providers';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import Link from 'next/link';
import Image from 'next/image';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import MessageContent from '@/components/MessageContent/MessageContent';
import styles from './chat.module.css';

/* ---- Agent Trail Steps ---- */
const AGENT_STEPS = [
    { id: 'parse', label: '解析报表字段', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></> },
    { id: 'identify', label: '识别数据结构', icon: <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></> },
    { id: 'diagnose', label: '效果诊断与归因', icon: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /> },
    { id: 'strategy', label: '生成优化策略', icon: <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></> },
];

export default function ChatPage() {
    const { user } = useAuth();
    const supabase = getSupabaseBrowser();

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [parsedData, setParsedData] = useState(null);
    const [dataContext, setDataContext] = useState('');
    const [showUpload, setShowUpload] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);
    const [activeHistoryId, setActiveHistoryId] = useState(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [sidebarSearch, setSidebarSearch] = useState('');

    // Agent Trail state
    const [agentTrail, setAgentTrail] = useState([]); // [{id, status: 'done'|'active'|'pending', detail}]
    const [showTrail, setShowTrail] = useState(false);

    // Project state
    const [projects, setProjects] = useState([]);
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [projectsExpanded, setProjectsExpanded] = useState(true);
    const [historyExpanded, setHistoryExpanded] = useState(true);

    // Active nav
    const [activeNav, setActiveNav] = useState('chat'); // 'home' | 'chat' | 'projects' | 'reports'

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const pdfInputRef = useRef(null);

    const activeProject = projects.find(p => p.id === activeProjectId) || null;

    // --- Load data from Supabase ---
    useEffect(() => {
        if (!user) return;
        loadProjects();
        loadChatHistory();
    }, [user]);

    const loadProjects = async () => {
        const { data } = await supabase
            .from('projects')
            .select('*, project_contexts(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (data) {
            setProjects(data.map(p => ({
                id: p.id,
                name: p.name,
                contexts: (p.project_contexts || []).map(c => ({
                    id: c.id,
                    fileName: c.file_name,
                    textContent: c.text_content,
                    size: c.file_size,
                })),
                createdAt: p.created_at,
            })));
        }
    };

    const loadChatHistory = async () => {
        const { data } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (data) {
            setChatHistory(data.map(s => ({
                id: s.id,
                title: s.title,
                messages: s.messages,
                projectId: s.project_id,
            })));
        }
    };

    const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
    useEffect(() => { scrollToBottom(); }, [messages, isLoading]);
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [input]);

    // --- Agent Trail simulation ---
    const runAgentTrail = useCallback(() => {
        setShowTrail(true);
        setAgentTrail(AGENT_STEPS.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending', detail: '' })));

        const details = [
            '识别到 Excel 格式，共 12 列、486 行数据',
            '发现 3 个广告平台，已统一字段口径',
            '完成全链路漏斗分析，定位 2 个异常计划',
            '已生成 4 条可执行优化建议',
        ];

        AGENT_STEPS.forEach((step, i) => {
            setTimeout(() => {
                setAgentTrail(prev => prev.map((s, j) => {
                    if (j < i) return { ...s, status: 'done', detail: details[j] };
                    if (j === i) return { ...s, status: 'active', detail: '' };
                    return { ...s, status: 'pending', detail: '' };
                }));
            }, i * 1800);

            setTimeout(() => {
                setAgentTrail(prev => prev.map((s, j) => {
                    if (j <= i) return { ...s, status: 'done', detail: details[j] };
                    if (j === i + 1) return { ...s, status: 'active', detail: '' };
                    return s;
                }));
            }, i * 1800 + 1400);
        });

        // Hide trail after all steps done
        setTimeout(() => {
            setTimeout(() => setShowTrail(false), 3000);
        }, AGENT_STEPS.length * 1800);
    }, []);

    // --- Project management ---
    const handleCreateProject = async () => {
        const name = newProjectName.trim();
        if (!name || !user) return;
        const { data, error } = await supabase
            .from('projects')
            .insert({ name, user_id: user.id })
            .select()
            .single();
        if (data && !error) {
            setProjects(prev => [{ id: data.id, name: data.name, contexts: [], createdAt: data.created_at }, ...prev]);
            setActiveProjectId(data.id);
        }
        setNewProjectName('');
        setShowProjectModal(false);
    };

    const handleDeleteProject = async (e, projectId) => {
        e.stopPropagation();
        await supabase.from('projects').delete().eq('id', projectId);
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (activeProjectId === projectId) setActiveProjectId(null);
    };

    const handlePdfUpload = async (file) => {
        if (!file || !activeProjectId || !user) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            let textContent = '';
            try {
                const bytes = new Uint8Array(e.target.result);
                const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
                const matches = text.match(/\(([^)]{2,})\)/g);
                if (matches) {
                    textContent = matches
                        .map(m => m.slice(1, -1))
                        .filter(s => s.length > 2 && /[\u4e00-\u9fff a-zA-Z0-9]/.test(s))
                        .join(' ')
                        .slice(0, 5000);
                }
                if (!textContent || textContent.length < 20) {
                    textContent = `[PDF 文件: ${file.name}, 大小: ${(file.size / 1024).toFixed(1)}KB]`;
                }
            } catch {
                textContent = `[PDF 文件: ${file.name}]`;
            }

            const { data } = await supabase
                .from('project_contexts')
                .insert({ project_id: activeProjectId, file_name: file.name, text_content: textContent, file_size: file.size })
                .select()
                .single();

            if (data) {
                const contextItem = { id: data.id, fileName: data.file_name, textContent: data.text_content, size: data.file_size };
                setProjects(prev => prev.map(p =>
                    p.id === activeProjectId ? { ...p, contexts: [...p.contexts, contextItem] } : p
                ));
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleRemoveContext = async (contextId) => {
        await supabase.from('project_contexts').delete().eq('id', contextId);
        setProjects(prev => prev.map(p =>
            p.id === activeProjectId ? { ...p, contexts: p.contexts.filter(c => c.id !== contextId) } : p
        ));
    };

    const getProjectContext = useCallback(() => {
        if (!activeProject || activeProject.contexts.length === 0) return '';
        let ctx = `\n\n--- Project Context: ${activeProject.name} ---\n`;
        activeProject.contexts.forEach(c => { ctx += `\n[文件: ${c.fileName}]\n${c.textContent}\n`; });
        return ctx;
    }, [activeProject]);

    const generateDataSummary = useCallback((data) => {
        if (!data || data.length === 0) return '';
        const headers = Object.keys(data[0]);
        const rowCount = data.length;
        let summary = `- 数据行数: ${rowCount} 行\n- 字段: ${headers.join(', ')}\n`;
        const numericCols = {};
        headers.forEach(h => {
            const values = data.map(r => parseFloat(r[h])).filter(v => !isNaN(v));
            if (values.length > rowCount * 0.5) {
                const sum = values.reduce((a, b) => a + b, 0);
                numericCols[h] = { avg: (sum / values.length).toFixed(2), min: Math.min(...values).toFixed(2), max: Math.max(...values).toFixed(2), sum: sum.toFixed(2) };
            }
        });
        if (Object.keys(numericCols).length > 0) {
            summary += '\n**关键数值字段摘要:**\n';
            Object.entries(numericCols).forEach(([col, stats]) => {
                summary += `- ${col}: 平均 ${stats.avg}, 范围 ${stats.min} ~ ${stats.max}, 合计 ${stats.sum}\n`;
            });
        }
        return summary;
    }, []);

    const handleFileUpload = useCallback((file) => {
        if (!file) return;
        const fileName = file.name.toLowerCase();
        setUploadedFile(file);
        setShowUpload(false);
        if (fileName.endsWith('.csv')) {
            Papa.parse(file, {
                header: true, dynamicTyping: true, skipEmptyLines: true,
                complete: (results) => {
                    const data = results.data.slice(0, 500);
                    setParsedData(data);
                    const summary = generateDataSummary(data);
                    setDataContext(summary);
                    runAgentTrail();
                    sendMessageWithData(`我上传了广告投放数据文件: ${file.name}`, summary);
                },
                error: () => addAiMessage('CSV 文件解析失败，请检查文件格式是否正确。'),
            });
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const workbook = XLSX.read(e.target.result, { type: 'binary' });
                    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]).slice(0, 500);
                    setParsedData(data);
                    const summary = generateDataSummary(data);
                    setDataContext(summary);
                    runAgentTrail();
                    sendMessageWithData(`我上传了广告投放数据文件: ${file.name}`, summary);
                } catch { addAiMessage('Excel 文件解析失败，请检查文件格式是否正确。'); }
            };
            reader.readAsBinaryString(file);
        } else {
            addAiMessage('不支持的文件格式，请上传 .xlsx、.xls 或 .csv 文件。');
        }
    }, [generateDataSummary, runAgentTrail]);

    const addAiMessage = (content) => { setMessages(prev => [...prev, { role: 'assistant', content }]); };

    const streamChat = useCallback(async (chatMessages, context) => {
        setIsLoading(true);
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: chatMessages.map(m => ({ role: m.role, content: m.content })), dataContext: context || null, stream: true })
            });
            if (!res.ok) {
                const err = await res.json();
                setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: err.error || '请求失败，请重试。' }; return u; });
                return;
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;
                    const data = trimmed.slice(6);
                    if (data === '[DONE]') continue;
                    try {
                        const json = JSON.parse(data);
                        if (json.content) {
                            setMessages(prev => { const u = [...prev]; const l = u[u.length - 1]; u[u.length - 1] = { ...l, content: l.content + json.content }; return u; });
                        }
                    } catch {}
                }
            }
        } catch {
            setMessages(prev => { const u = [...prev]; if (u[u.length - 1]?.content === '') u[u.length - 1] = { role: 'assistant', content: '网络错误，请检查连接后重试。' }; return u; });
        } finally { setIsLoading(false); }
    }, []);

    const sendMessageWithData = async (userMsg, dataSummary) => {
        const newMessages = [...messages, { role: 'user', content: userMsg }];
        setMessages(newMessages);
        await streamChat(newMessages, (dataSummary || '') + getProjectContext());
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        const userMessage = input.trim();
        setInput('');
        const newMessages = [...messages, { role: 'user', content: userMessage }];
        setMessages(newMessages);
        await streamChat(newMessages, (dataContext || '') + getProjectContext());
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
    const handleDrop = (e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files[0]); };
    const handleDragOver = (e) => { e.preventDefault(); };

    const saveChatSession = async (msgs) => {
        if (!user || msgs.length === 0) return null;
        const title = msgs[0]?.content?.slice(0, 30) || '新对话';
        const { data } = await supabase
            .from('chat_sessions')
            .insert({ user_id: user.id, title, messages: msgs, project_id: activeProjectId })
            .select()
            .single();
        if (data) {
            setChatHistory(prev => [{ id: data.id, title: data.title, messages: data.messages, projectId: data.project_id }, ...prev]);
        }
        return data;
    };

    const handleNewChat = async () => {
        if (messages.length > 0 && !activeHistoryId) {
            await saveChatSession(messages);
        }
        setMessages([]); setUploadedFile(null); setParsedData(null); setDataContext(''); setInput(''); setActiveHistoryId(null); setShowTrail(false); setAgentTrail([]);
    };

    const loadHistory = async (item) => {
        if (messages.length > 0 && !activeHistoryId) {
            await saveChatSession(messages);
        }
        setMessages(item.messages); setActiveHistoryId(item.id);
        if (item.projectId) setActiveProjectId(item.projectId);
        setUploadedFile(null); setParsedData(null); setDataContext(''); setInput(''); setShowTrail(false); setAgentTrail([]);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
    };

    // Filter sidebar items by search
    const filteredProjects = sidebarSearch ? projects.filter(p => p.name.toLowerCase().includes(sidebarSearch.toLowerCase())) : projects;
    const filteredHistory = sidebarSearch ? chatHistory.filter(h => h.title.toLowerCase().includes(sidebarSearch.toLowerCase())) : chatHistory;

    // Get greeting
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return '早上好';
        if (hour < 18) return '下午好';
        return '晚上好';
    };

    return (
        <div className={`chatThemeLight ${styles.chatLayout}`} onDrop={handleDrop} onDragOver={handleDragOver}>
            {/* Sidebar */}
            <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
                {/* Sidebar Top: Logo + Collapse */}
                <div className={styles.sidebarHeader}>
                    <Link href="/" className={styles.sidebarLogo}>
                        <Image src="/logo-light.svg" alt="AdPilot" width={28} height={28} className={styles.sidebarLogoIcon} />
                        {!sidebarCollapsed && <span>AdPilot</span>}
                    </Link>
                    <button className={styles.collapseBtn} onClick={() => setSidebarCollapsed(v => !v)} title={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {sidebarCollapsed
                                ? <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
                                : <><polyline points="11 17 6 12 11 7"/><line x1="6" y1="12" x2="18" y2="12"/></>
                            }
                        </svg>
                    </button>
                </div>

                {!sidebarCollapsed && (
                    <>
                        {/* Command Bar */}
                        <div className={styles.commandBar}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input
                                type="text"
                                className={styles.commandInput}
                                placeholder="搜索对话和项目..."
                                value={sidebarSearch}
                                onChange={(e) => setSidebarSearch(e.target.value)}
                            />
                        </div>

                        {/* Nav Icons */}
                        <nav className={styles.sidebarNav}>
                            <button className={`${styles.navItem} ${activeNav === 'chat' ? styles.navItemActive : ''}`} onClick={() => { setActiveNav('chat'); }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                对话
                            </button>
                            <button className={`${styles.navItem} ${activeNav === 'projects' ? styles.navItemActive : ''}`} onClick={() => { setActiveNav('projects'); }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                项目
                            </button>
                        </nav>
                    </>
                )}

                <div className={styles.sidebarContent}>
                    {!sidebarCollapsed && (
                        <>
                            {/* New Chat Button */}
                            <button className={styles.newChatBtn} onClick={handleNewChat}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                新建对话
                            </button>

                            {/* Projects Section */}
                            <div className={styles.sidebarSection}>
                                <div className={styles.sidebarSectionHeader} onClick={() => setProjectsExpanded(v => !v)}>
                                    <span className={styles.sectionHeaderLeft}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: projectsExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                                            <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                        项目
                                        <span className={styles.sectionCount}>{projects.length}</span>
                                    </span>
                                    <button className={styles.sectionAddBtn} onClick={(e) => { e.stopPropagation(); setShowProjectModal(true); }} title="新建项目">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                    </button>
                                </div>

                                {projectsExpanded && (
                                    <>
                                        {filteredProjects.length === 0 ? (
                                            <div className={styles.sidebarEmpty}>
                                                <span>{sidebarSearch ? '无匹配项目' : '暂无项目'}</span>
                                                {!sidebarSearch && <button className={styles.emptyCreateBtn} onClick={() => setShowProjectModal(true)}>创建项目</button>}
                                            </div>
                                        ) : filteredProjects.map(proj => (
                                            <div key={proj.id} className={`${styles.projectItem} ${activeProjectId === proj.id ? styles.projectItemActive : ''}`} onClick={() => setActiveProjectId(activeProjectId === proj.id ? null : proj.id)}>
                                                <div className={styles.projectItemLeft}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                                                    <span className={styles.projectItemName}>{proj.name}</span>
                                                </div>
                                                <div className={styles.projectItemRight}>
                                                    {proj.contexts.length > 0 && <span className={styles.projectContextCount}>{proj.contexts.length}</span>}
                                                    <button className={styles.projectDeleteBtn} onClick={(e) => handleDeleteProject(e, proj.id)} title="删除项目">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {activeProject && (
                                            <div className={styles.projectContextPanel}>
                                                <div className={styles.projectContextTitle}>
                                                    <span>上下文文件</span>
                                                    <button className={styles.sectionAddBtn} onClick={() => pdfInputRef.current?.click()} title="上传 PDF">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                                    </button>
                                                    <input ref={pdfInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={(e) => { handlePdfUpload(e.target.files[0]); e.target.value = ''; }} />
                                                </div>
                                                {activeProject.contexts.length === 0 ? (
                                                    <div className={styles.contextEmpty} onClick={() => pdfInputRef.current?.click()}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                                        <span>上传 PDF 作为分析上下文</span>
                                                    </div>
                                                ) : activeProject.contexts.map(ctx => (
                                                    <div key={ctx.id} className={styles.contextFile}>
                                                        <div className={styles.contextFileLeft}>
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                                            <span>{ctx.fileName}</span>
                                                        </div>
                                                        <button className={styles.contextRemoveBtn} onClick={() => handleRemoveContext(ctx.id)}>
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* History Section */}
                            <div className={styles.sidebarSection}>
                                <div className={styles.sidebarSectionHeader} onClick={() => setHistoryExpanded(v => !v)}>
                                    <span className={styles.sectionHeaderLeft}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: historyExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                                            <polyline points="9 18 15 12 9 6" />
                                        </svg>
                                        历史记录
                                        <span className={styles.sectionCount}>{chatHistory.length}</span>
                                    </span>
                                </div>
                                {historyExpanded && (
                                    <>
                                        {filteredHistory.length === 0 ? (
                                            <div className={styles.sidebarEmpty}><span>{sidebarSearch ? '无匹配记录' : '暂无分析记录'}</span></div>
                                        ) : filteredHistory.map(item => (
                                            <div key={item.id} className={`${styles.historyItem} ${activeHistoryId === item.id ? styles.historyItemActive : ''}`} onClick={() => loadHistory(item)}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                                <div className={styles.historyItemContent}>
                                                    {item.projectId && <span className={styles.historyProjectTag}>{projects.find(p => p.id === item.projectId)?.name || '项目'}</span>}
                                                    <span className={styles.historyItemTitle}>{item.title}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Sidebar Footer: User */}
                <div className={styles.sidebarFooter}>
                    {user ? (
                        <div className={styles.sidebarUser} onClick={handleLogout}>
                            <div className={styles.userAvatarWrap}>
                                {user.user_metadata?.avatar_url ? (
                                    <img src={user.user_metadata.avatar_url} alt="" className={styles.sidebarUserAvatarImg} referrerPolicy="no-referrer" />
                                ) : (
                                    <div className={styles.sidebarUserAvatar}>{(user.user_metadata?.full_name || user.email)?.[0] || 'U'}</div>
                                )}
                                <span className={styles.onlineDot}></span>
                            </div>
                            {!sidebarCollapsed && (
                                <div className={styles.sidebarUserInfo}>
                                    <div className={styles.sidebarUserName}>{user.user_metadata?.full_name || user.email || '用户'}</div>
                                    <div className={styles.sidebarUserDesc}>点击退出登录</div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className={styles.sidebarUser} onClick={() => window.location.href = '/login'}>
                            <div className={styles.sidebarUserAvatar}>?</div>
                            {!sidebarCollapsed && (
                                <div className={styles.sidebarUserInfo}>
                                    <div className={styles.sidebarUserName}>未登录</div>
                                    <div className={styles.sidebarUserDesc}>点击登录</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </aside>

            {/* Main */}
            <main className={styles.main}>
                {/* Top Toolbar */}
                <header className={styles.chatHeader}>
                    <div className={styles.chatHeaderLeft}>
                        <h1 className={styles.chatHeaderTitle}>
                            {uploadedFile ? '投放数据分析' : activeProject ? activeProject.name : '新建分析'}
                        </h1>
                        {uploadedFile && (
                            <div className={styles.chatHeaderBadge}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                {uploadedFile.name}
                            </div>
                        )}
                        {activeProject && (
                            <div className={styles.chatHeaderBadge}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                                {activeProject.name}
                                {activeProject.contexts.length > 0 && <span className={styles.badgeCount}>{activeProject.contexts.length} 文件</span>}
                            </div>
                        )}
                    </div>
                    <div className={styles.chatHeaderRight}>
                        <button className={styles.headerBtn} onClick={() => setShowUpload(true)} title="上传报表">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                        </button>
                        <button className={styles.headerBtn} title="导出报告">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        </button>
                    </div>
                </header>

                {messages.length === 0 ? (
                    /* ====== Empty State (ROX-style) ====== */
                    <div className={styles.emptyState}>
                        <div className={styles.emptyStateContent}>
                            {/* Greeting */}
                            <div className={styles.greetingIcon}>
                                <Image src="/logo-light.svg" alt="AdPilot" width={48} height={48} />
                            </div>
                            <h2 className={styles.greetingTitle}>
                                {getGreeting()}，{user?.user_metadata?.full_name?.split(' ')[0] || '你好'}
                            </h2>
                            <p className={styles.greetingSubtitle}>
                                {activeProject ? `当前项目: ${activeProject.name}` : '有什么可以帮你分析的？'}
                            </p>

                            {/* Input Box */}
                            <div className={styles.inputContainer}>
                                <div className={styles.inputRow}>
                                    <textarea ref={textareaRef} className={styles.inputField} placeholder={activeProject ? `在「${activeProject.name}」项目中提问...` : '描述你的分析需求，或上传投放报表...'} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} rows={1} id="chat-input" />
                                </div>
                                <div className={styles.inputActions}>
                                    <div className={styles.inputActionsLeft}>
                                        <button className={styles.inputActionBtn} onClick={() => setShowUpload(true)} title="上传文件">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                                        </button>
                                    </div>
                                    <div className={styles.inputActionsRight}>
                                        <button className={styles.sendBtn} onClick={handleSend} disabled={!input.trim() || isLoading} id="send-btn">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Prompt Suggestion Cards */}
                            <div className={styles.promptCards}>
                                <button className={styles.promptCard} onClick={() => setShowUpload(true)}>
                                    <div className={styles.promptCardIcon}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                    </div>
                                    <div className={styles.promptCardText}>
                                        <span className={styles.promptCardTitle}>上传投放报表</span>
                                        <span className={styles.promptCardDesc}>Excel / CSV 格式</span>
                                    </div>
                                </button>
                                <button className={styles.promptCard} onClick={() => setInput('帮我分析上周 Facebook 广告的 ROAS 变化趋势')}>
                                    <div className={styles.promptCardIcon}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                                    </div>
                                    <div className={styles.promptCardText}>
                                        <span className={styles.promptCardTitle}>分析 ROAS 趋势</span>
                                        <span className={styles.promptCardDesc}>效果归因与波动诊断</span>
                                    </div>
                                </button>
                                <button className={styles.promptCard} onClick={() => setInput('对比不同广告计划的表现，找出低效计划和优化空间')}>
                                    <div className={styles.promptCardIcon}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>
                                    </div>
                                    <div className={styles.promptCardText}>
                                        <span className={styles.promptCardTitle}>对比计划表现</span>
                                        <span className={styles.promptCardDesc}>定位低效投放</span>
                                    </div>
                                </button>
                                <button className={styles.promptCard} onClick={() => setInput('根据当前数据，给出预算再分配的建议')}>
                                    <div className={styles.promptCardIcon}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                                    </div>
                                    <div className={styles.promptCardText}>
                                        <span className={styles.promptCardTitle}>预算优化建议</span>
                                        <span className={styles.promptCardDesc}>智能再分配方案</span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Agent Trail */}
                        {showTrail && (
                            <div className={styles.agentTrail}>
                                <div className={styles.agentTrailHeader}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    Agent 工作流
                                </div>
                                <div className={styles.agentTrailSteps}>
                                    {agentTrail.map((step, i) => (
                                        <div key={step.id} className={`${styles.agentStep} ${styles[`agentStep_${step.status}`]}`}>
                                            <div className={styles.agentStepIndicator}>
                                                {step.status === 'done' ? (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                ) : step.status === 'active' ? (
                                                    <div className={styles.agentStepSpinner}></div>
                                                ) : (
                                                    <div className={styles.agentStepDot}></div>
                                                )}
                                            </div>
                                            <div className={styles.agentStepBody}>
                                                <span className={styles.agentStepLabel}>{step.label}</span>
                                                {step.detail && <span className={styles.agentStepDetail}>{step.detail}</span>}
                                            </div>
                                            {i < agentTrail.length - 1 && <div className={`${styles.agentStepLine} ${step.status === 'done' ? styles.agentStepLineDone : ''}`}></div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className={styles.messagesArea}>
                            <div className={styles.messagesContainer}>
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : ''}`}>
                                        <div className={`${styles.messageAvatar} ${msg.role === 'assistant' ? styles.messageAvatarAi : styles.messageAvatarUser}`}>
                                            {msg.role === 'assistant' ? (
                                                <Image src="/logo-light.svg" alt="AI" width={20} height={20} />
                                            ) : 'U'}
                                        </div>
                                        <div className={styles.messageBody}>
                                            <div className={`${styles.messageBubble} ${msg.role === 'assistant' ? styles.messageBubbleAi : styles.messageBubbleUser}`}>
                                                <MessageContent content={msg.content} />
                                                {msg.role === 'user' && msg.content.includes('上传了广告投放数据') && parsedData && (
                                                    <div className={styles.dataPreview}>
                                                        <div className={styles.dataPreviewHeader}><span>数据预览（前 5 行）</span><span>{parsedData.length} 行数据</span></div>
                                                        <div style={{ overflowX: 'auto' }}>
                                                            <table className={styles.dataPreviewTable}>
                                                                <thead><tr>{Object.keys(parsedData[0] || {}).slice(0, 6).map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                                                                <tbody>{parsedData.slice(0, 5).map((row, i) => <tr key={i}>{Object.keys(parsedData[0] || {}).slice(0, 6).map((h, j) => <td key={j}>{row[h]?.toString() || '-'}</td>)}</tr>)}</tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            {msg.role === 'assistant' && <div className={styles.messageModel}><span className={styles.messageModelDot}></span>AdPilot Agent</div>}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className={styles.typing}>
                                        <div className={`${styles.messageAvatar} ${styles.messageAvatarAi}`}>
                                            <Image src="/logo-light.svg" alt="AI" width={20} height={20} />
                                        </div>
                                        <div className={styles.typingDots}><div className={styles.typingDot}></div><div className={styles.typingDot}></div><div className={styles.typingDot}></div></div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                        <div className={styles.inputArea}>
                            <div className={styles.inputContainer}>
                                <div className={styles.inputRow}>
                                    <textarea ref={textareaRef} className={styles.inputField} placeholder={activeProject ? `在「${activeProject.name}」项目中提问...` : '继续提问...'} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} rows={1} id="chat-input" />
                                </div>
                                <div className={styles.inputActions}>
                                    <div className={styles.inputActionsLeft}>
                                        <button className={styles.inputActionBtn} onClick={() => setShowUpload(true)} title="上传文件">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                                        </button>
                                    </div>
                                    <div className={styles.inputActionsRight}>
                                        <button className={styles.sendBtn} onClick={handleSend} disabled={!input.trim() || isLoading} id="send-btn">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>

            {/* Upload Overlay */}
            {showUpload && (
                <div className={styles.uploadOverlay} onClick={() => setShowUpload(false)}>
                    <div className={styles.uploadBox} onClick={e => e.stopPropagation()}>
                        <div className={styles.uploadDropzone} onClick={() => fileInputRef.current?.click()}>
                            <svg className={styles.uploadIcon} width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                            <div className={styles.uploadTitle}>拖拽文件至此，或点击选择</div>
                            <div className={styles.uploadDesc}>支持 .xlsx, .xls, .csv 格式的投放数据报表</div>
                        </div>
                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e.target.files[0])} />
                        <button className={styles.uploadClose} onClick={() => setShowUpload(false)}>取消</button>
                    </div>
                </div>
            )}

            {/* Create Project Modal */}
            {showProjectModal && (
                <div className={styles.uploadOverlay} onClick={() => setShowProjectModal(false)}>
                    <div className={styles.projectModal} onClick={e => e.stopPropagation()}>
                        <h3 className={styles.projectModalTitle}>创建项目</h3>
                        <p className={styles.projectModalDesc}>为您的广告投放分析创建一个项目，上传 PDF 文件作为分析上下文</p>
                        <input className={styles.projectModalInput} type="text" placeholder="输入项目名称..." value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); }} autoFocus />
                        <div className={styles.projectModalActions}>
                            <button className={styles.uploadClose} onClick={() => setShowProjectModal(false)}>取消</button>
                            <button className={styles.projectModalCreate} onClick={handleCreateProject} disabled={!newProjectName.trim()}>创建</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
