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

    // Project state
    const [projects, setProjects] = useState([]);
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [projectsExpanded, setProjectsExpanded] = useState(true);

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
                    sendMessageWithData(`我上传了广告投放数据文件: ${file.name}`, summary);
                } catch { addAiMessage('Excel 文件解析失败，请检查文件格式是否正确。'); }
            };
            reader.readAsBinaryString(file);
        } else {
            addAiMessage('不支持的文件格式，请上传 .xlsx、.xls 或 .csv 文件。');
        }
    }, [generateDataSummary]);

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
        setMessages([]); setUploadedFile(null); setParsedData(null); setDataContext(''); setInput(''); setActiveHistoryId(null);
    };

    const loadHistory = async (item) => {
        if (messages.length > 0 && !activeHistoryId) {
            await saveChatSession(messages);
        }
        setMessages(item.messages); setActiveHistoryId(item.id);
        if (item.projectId) setActiveProjectId(item.projectId);
        setUploadedFile(null); setParsedData(null); setDataContext(''); setInput('');
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
    };

    return (
        <div className={`chatThemeLight ${styles.chatLayout}`} onDrop={handleDrop} onDragOver={handleDragOver}>
            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <Link href="/" className={styles.sidebarLogo}>
                        <Image src="/logo-light.svg" alt="AdPilot" width={28} height={28} className={styles.sidebarLogoIcon} />
                        AdPilot
                    </Link>
                </div>

                <div className={styles.sidebarContent}>
                    <div className={styles.sidebarActions}>
                        <button className={styles.sidebarActionBtn} onClick={handleNewChat}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                            新建分析
                        </button>
                        <button className={styles.sidebarActionBtn} onClick={() => setShowUpload(true)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                            上传数据
                        </button>
                    </div>

                    {/* Projects */}
                    <div className={styles.sidebarSection}>
                        <div className={styles.sidebarSectionHeader} onClick={() => setProjectsExpanded(v => !v)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: projectsExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                                项目
                            </span>
                            <button className={styles.sectionAddBtn} onClick={(e) => { e.stopPropagation(); setShowProjectModal(true); }} title="新建项目">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                            </button>
                        </div>

                        {projectsExpanded && (
                            <>
                                {projects.length === 0 ? (
                                    <div className={styles.sidebarEmpty}>
                                        <span>暂无项目</span>
                                        <button className={styles.emptyCreateBtn} onClick={() => setShowProjectModal(true)}>创建项目</button>
                                    </div>
                                ) : projects.map(proj => (
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

                    {/* History */}
                    <div className={styles.sidebarSection}>
                        <div className={styles.sidebarSectionHeader}>历史记录</div>
                        {chatHistory.length === 0 ? (
                            <div className={styles.sidebarEmpty}><span>暂无分析记录</span></div>
                        ) : chatHistory.map(item => (
                            <div key={item.id} className={`${styles.historyItem} ${activeHistoryId === item.id ? styles.historyItemActive : ''}`} onClick={() => loadHistory(item)}>
                                {item.projectId && <span className={styles.historyProjectTag}>{projects.find(p => p.id === item.projectId)?.name || '项目'}</span>}
                                {item.title}
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.sidebarFooter}>
                    {user ? (
                        <div className={styles.sidebarUser} onClick={handleLogout}>
                            {user.user_metadata?.avatar_url ? (
                                <img src={user.user_metadata.avatar_url} alt="" className={styles.sidebarUserAvatarImg} referrerPolicy="no-referrer" />
                            ) : (
                                <div className={styles.sidebarUserAvatar}>{(user.user_metadata?.full_name || user.email)?.[0] || 'U'}</div>
                            )}
                            <div className={styles.sidebarUserInfo}>
                                <div className={styles.sidebarUserName}>{user.user_metadata?.full_name || user.email || '用户'}</div>
                                <div className={styles.sidebarUserDesc}>点击退出登录</div>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.sidebarUser} onClick={() => window.location.href = '/login'}>
                            <div className={styles.sidebarUserAvatar}>?</div>
                            <div className={styles.sidebarUserInfo}>
                                <div className={styles.sidebarUserName}>未登录</div>
                                <div className={styles.sidebarUserDesc}>点击登录</div>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main */}
            <main className={styles.main}>
                <header className={styles.chatHeader}>
                    <div className={styles.chatHeaderLeft}>
                        <h1 className={styles.chatHeaderTitle}>{uploadedFile ? '投放数据分析' : '新建分析'}</h1>
                        {uploadedFile && (
                            <div className={styles.chatHeaderFile}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                {uploadedFile.name}
                            </div>
                        )}
                        {activeProject && (
                            <div className={styles.chatHeaderProject}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                                {activeProject.name}
                                {activeProject.contexts.length > 0 && <span className={styles.chatHeaderContextBadge}>{activeProject.contexts.length} 文件</span>}
                            </div>
                        )}
                    </div>
                    <div className={styles.chatHeaderRight}>
                        <button className={styles.headerBtn} onClick={() => setShowUpload(true)} title="上传文件">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                        </button>
                    </div>
                </header>

                {messages.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyStateContent}>
                            <h2 className={styles.welcomeTitle}>AdPilot</h2>
                            <p className={styles.welcomeSubtitle}>
                                {activeProject ? `当前项目: ${activeProject.name}${activeProject.contexts.length > 0 ? ` (${activeProject.contexts.length} 个上下文文件)` : ''}` : '上传投放数据或描述您的分析需求'}
                            </p>
                            <div className={styles.inputContainer}>
                                <div className={styles.inputRow}>
                                    <textarea ref={textareaRef} className={styles.inputField} placeholder={activeProject ? `在「${activeProject.name}」项目中提问...` : '描述您的分析需求...'} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} rows={1} id="chat-input" />
                                </div>
                                <div className={styles.inputActions}>
                                    <div className={styles.inputActionsLeft}>
                                        <button className={styles.inputActionBtn} onClick={() => setShowUpload(true)} title="上传文件">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                                        </button>
                                    </div>
                                    <div className={styles.inputActionsRight}>
                                        <button className={styles.sendBtn} onClick={handleSend} disabled={!input.trim() || isLoading} id="send-btn">
                                            发送<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.welcomeHints}>
                                <button className={styles.welcomeHint} onClick={() => setShowUpload(true)}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                    上传投放报表开始分析
                                </button>
                                <button className={styles.welcomeHint} onClick={() => setInput('帮我分析一下最近一周的投放效果，重点看 ROI 和转化成本的变化趋势')}>分析投放效果与 ROI 趋势</button>
                                <button className={styles.welcomeHint} onClick={() => setInput('对比不同广告计划的表现，找出低效计划和优化空间')}>对比计划表现，定位低效投放</button>
                                <button className={styles.welcomeHint} onClick={() => setInput('根据当前数据，给出预算再分配的建议')}>获取预算优化建议</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className={styles.messagesArea}>
                            <div className={styles.messagesContainer}>
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : ''}`}>
                                        <div className={`${styles.messageAvatar} ${msg.role === 'assistant' ? styles.messageAvatarAi : styles.messageAvatarUser}`}>{msg.role === 'assistant' ? 'A' : 'U'}</div>
                                        <div>
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
                                            {msg.role === 'assistant' && <div className={styles.messageModel}><span className={styles.messageModelDot}></span>AdPilot AI</div>}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && <div className={styles.typing}><div className={`${styles.messageAvatar} ${styles.messageAvatarAi}`}>A</div><div className={styles.typingDots}><div className={styles.typingDot}></div><div className={styles.typingDot}></div><div className={styles.typingDot}></div></div></div>}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                        <div className={styles.inputArea}>
                            <div className={styles.inputContainer}>
                                <div className={styles.inputRow}>
                                    <textarea ref={textareaRef} className={styles.inputField} placeholder={activeProject ? `在「${activeProject.name}」项目中提问...` : '描述您的分析需求...'} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} rows={1} id="chat-input" />
                                </div>
                                <div className={styles.inputActions}>
                                    <div className={styles.inputActionsLeft}>
                                        <button className={styles.inputActionBtn} onClick={() => setShowUpload(true)} title="上传文件">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                                        </button>
                                    </div>
                                    <div className={styles.inputActionsRight}>
                                        <button className={styles.sendBtn} onClick={handleSend} disabled={!input.trim() || isLoading} id="send-btn">
                                            发送<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
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
