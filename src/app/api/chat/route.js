const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

const SYSTEM_PROMPT = `你是 AdPilot，一位资深的广告投放优化专家。你精通 Facebook Ads、Google Ads、TikTok Ads、小红书、抖音等主流广告平台的投放策略。

核心能力：
1. 能够解读广告投放数据，发现关键洞察
2. 根据用户的行业、目标和预算，给出定制化建议
3. 使用数据驱动的方式论证你的建议
4. 当数据不足时，主动询问用户补充信息
5. 能够分析 CPC、CTR、CPM、CPA、ROAS 等核心指标

输出风格：
- 使用 Markdown 格式输出，充分利用标题、列表、表格、加粗等
- 结构清晰，使用编号和要点
- 先给结论，再给论据
- 建议具体可执行，避免空泛
- 数据分析时给出具体数值和百分比变化
- 当用户上传数据时，先对数据进行概览分析，再深入特定维度
- 当需要展示数据对比时，使用 Markdown 表格

图表能力：
- 当分析涉及趋势、对比、占比等可视化场景时，你可以输出 ECharts 图表
- 使用如下格式嵌入图表（必须是合法 JSON）：
\`\`\`chart
{
  "title": { "text": "图表标题", "left": "center" },
  "xAxis": { "type": "category", "data": ["Mon","Tue","Wed"] },
  "yAxis": { "type": "value" },
  "series": [{ "type": "line", "data": [100,200,150] }]
}
\`\`\`
- 仅在确实有数据支撑时才生成图表，不要凭空编造数据

第一次对话时，你应该：
1. 热情欢迎用户
2. 如果用户已上传数据，先给出数据概览
3. 询问投放平台、投放目标、关注的核心指标
4. 了解用户的行业和预算情况`;

export async function POST(request) {
    try {
        const body = await request.json();
        const messages = body.messages || [];
        const dataContext = body.dataContext || null;
        const stream = body.stream !== false; // default to stream

        const apiMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
        ];

        if (dataContext) {
            apiMessages.push({
                role: 'system',
                content: `用户已上传广告投放数据，以下是数据摘要：\n${dataContext}`
            });
        }

        apiMessages.push(...messages);

        if (!DEEPSEEK_API_KEY) {
            // Demo mode: simulate streaming with SSE
            const demoText = getDemoResponse(messages, dataContext);
            if (stream) {
                return createDemoStream(demoText);
            }
            return Response.json({ message: demoText, model: 'demo-mode' });
        }

        // Real API call with streaming
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: apiMessages,
                temperature: 0.7,
                max_tokens: 2048,
                stream: true,
            }),
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Deepseek API error:', errorData);
            return Response.json(
                { error: 'AI 服务暂时不可用，请稍后重试' },
                { status: 500 }
            );
        }

        // Proxy the SSE stream
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                try {
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
                            if (data === '[DONE]') {
                                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                                continue;
                            }
                            try {
                                const json = JSON.parse(data);
                                const content = json.choices?.[0]?.delta?.content;
                                if (content) {
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                                }
                            } catch { /* skip malformed */ }
                        }
                    }
                } catch (err) {
                    console.error('Stream error:', err);
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error) {
        console.error('Chat API error:', error);
        return Response.json(
            { error: '服务器错误，请稍后重试' },
            { status: 500 }
        );
    }
}

/** Simulate SSE streaming for demo mode */
function createDemoStream(text) {
    const encoder = new TextEncoder();
    // Split into small chunks to simulate streaming
    const words = text.split('');
    let index = 0;

    const readable = new ReadableStream({
        async start(controller) {
            const chunkSize = 3; // characters per chunk
            const delay = 15; // ms between chunks

            while (index < words.length) {
                const chunk = words.slice(index, index + chunkSize).join('');
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
                index += chunkSize;
                await new Promise(r => setTimeout(r, delay));
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
        }
    });

    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}

function getDemoResponse(messages, dataContext) {
    const lastMessage = messages[messages.length - 1]?.content || '';

    if (dataContext && messages.length <= 1) {
        return `## 欢迎使用 AdPilot!

我已收到您上传的投放数据，让我先为您做一个快速概览：

### 数据概览
${dataContext}

---

在深入分析之前，我想了解几个关键信息：

1. **投放平台** — 这些数据来自哪个广告平台？（Facebook / Google / TikTok / 小红书 / 抖音）
2. **投放目标** — 您的主要目标是什么？（品牌曝光 / 引流获客 / 直接转化 / APP下载）
3. **核心关注** — 您目前最关注哪个指标？（成本控制 / 转化率提升 / ROI 优化）

请告诉我这些信息，我会为您提供针对性的分析和建议。`;
    }

    if (messages.length <= 1 && !dataContext) {
        return `## 您好！我是 AdPilot

您的 AI 广告投放优化助手，我可以帮您：

- **分析投放数据** — 发现趋势、异常和优化空间
- **优化建议** — 基于数据给出预算分配和出价策略
- **效果预测** — 预测优化后的效果提升

**开始之前，您可以：**
1. 上传您的广告投放数据（Excel 或 CSV 格式）
2. 直接告诉我您的投放情况和遇到的问题

让我们开始吧！`;
    }

    if (lastMessage.includes('ROI') || lastMessage.includes('趋势') || lastMessage.includes('分析')) {
        return `## 投放效果分析

基于您的需求，以下是关键指标的趋势分析：

\`\`\`chart
{
  "title": { "text": "近7日核心指标趋势", "left": "center", "textStyle": { "fontSize": 14 } },
  "tooltip": { "trigger": "axis" },
  "legend": { "bottom": 0, "data": ["花费", "转化数", "CPA"] },
  "xAxis": { "type": "category", "data": ["周一","周二","周三","周四","周五","周六","周日"] },
  "yAxis": [{ "type": "value", "name": "花费/转化" }, { "type": "value", "name": "CPA" }],
  "series": [
    { "name": "花费", "type": "bar", "data": [2800, 3200, 2900, 3500, 4100, 3800, 3600], "color": "#1D1D1F" },
    { "name": "转化数", "type": "bar", "data": [45, 52, 48, 58, 62, 55, 51], "color": "#34C759" },
    { "name": "CPA", "type": "line", "yAxisIndex": 1, "data": [62, 61, 60, 60, 66, 69, 71], "color": "#FF9500" }
  ]
}
\`\`\`

### 关键发现

| 指标 | 本周均值 | 上周均值 | 变化 |
|------|---------|---------|------|
| 日均花费 | ¥3,414 | ¥3,100 | +10.1% |
| 日均转化 | 53 | 49 | +8.2% |
| 平均 CPA | ¥64.2 | ¥58.5 | +9.7% |
| CTR | 2.3% | 2.5% | -0.2pp |

### 诊断结论

1. **CPA 上升趋势明显** — 周五开始 CPA 从 ¥60 攀升至 ¥71，涨幅 18%，需要关注
2. **CTR 轻微下滑** — 可能存在素材疲劳，建议更新创意素材
3. **花费增长快于转化增长** — 边际效率在降低，建议收缩低效计划的预算

### 优化建议

- **短期**：暂停 CPA > ¥75 的广告组，预算向 CPA < ¥55 的广告组倾斜
- **中期**：准备 2-3 套新素材替换当前主力素材
- **关注**：周末转化效率偏低，可以考虑降低周末的预算比例

需要我进一步分析哪个方向？`;
    }

    if (lastMessage.includes('对比') || lastMessage.includes('计划') || lastMessage.includes('低效')) {
        return `## 广告计划对比分析

\`\`\`chart
{
  "title": { "text": "各计划 ROAS 对比", "left": "center", "textStyle": { "fontSize": 14 } },
  "tooltip": { "trigger": "axis" },
  "xAxis": { "type": "category", "data": ["计划A-品牌词", "计划B-竞品词", "计划C-通用词", "计划D-再营销", "计划E-拉新"] },
  "yAxis": { "type": "value", "name": "ROAS" },
  "series": [{ "type": "bar", "data": [4.2, 1.8, 0.9, 5.1, 1.2], "color": "#1D1D1F", "label": { "show": true, "position": "top" } }],
  "markLine": { "data": [{ "yAxis": 2, "label": { "formatter": "盈亏线 ROAS=2" } }] }
}
\`\`\`

### 计划表现排名

| 排名 | 计划 | 花费 | 转化 | ROAS | 建议 |
|------|------|------|------|------|------|
| 1 | 计划D-再营销 | ¥5,200 | 86 | 5.1 | 加大预算 |
| 2 | 计划A-品牌词 | ¥8,400 | 112 | 4.2 | 维持 |
| 3 | 计划B-竞品词 | ¥6,100 | 34 | 1.8 | 观察优化 |
| 4 | 计划E-拉新 | ¥4,800 | 18 | 1.2 | 缩减预算 |
| 5 | 计划C-通用词 | ¥3,500 | 10 | 0.9 | **建议暂停** |

### 优化方案

1. **立即暂停**计划C（通用词），ROAS 仅 0.9，持续亏损
2. **缩减 50%** 计划E（拉新）的预算，ROAS 1.2 低于盈亏线
3. **释放的预算重新分配**给计划D（再营销）和计划A（品牌词）
4. 预计调整后整体 ROAS 可从 **2.6 提升至 3.4**（+31%）

需要我帮您制定详细的预算调整方案吗？`;
    }

    return `## 分析结果

根据您提供的信息，我有以下分析和建议：

### 核心发现

1. **受众优化** — 建议缩小受众范围，聚焦高转化人群
2. **出价策略** — 可以尝试使用自动出价（CBO），让系统自动优化预算分配
3. **素材迭代** — 建议每 3-5 天更新一次素材，保持新鲜度
4. **时段优化** — 根据数据，建议在转化高峰时段增加投放

### 下一步建议

| 优先级 | 动作 | 预期效果 |
|--------|------|---------|
| P0 | 暂停低效广告组 | 减少 15% 无效花费 |
| P0 | 调整出价策略 | CPA 降低 10-15% |
| P1 | 更新素材创意 | CTR 提升 0.3-0.5pp |
| P2 | 优化投放时段 | 转化率提升 8% |

还有什么需要我分析的吗？`;
}
