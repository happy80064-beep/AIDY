const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const llmService = require('./llmService');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// --- Simple File Storage for Sessions ---
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Helper to read/write sessions
const getSessions = () => {
    if (!fs.existsSync(SESSIONS_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
};

const saveSession = (id, data) => {
    const sessions = getSessions();
    sessions[id] = { ...sessions[id], ...data, updatedAt: Date.now() };
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
    return sessions[id];
};

// --- Routes ---

// 1. Chat / Generate Content
app.post('/api/chat', async (req, res) => {
    const { provider, model, messages, jsonMode } = req.body;
    
    if (!provider || !messages) {
        return res.status(400).json({ error: 'Missing provider or messages' });
    }

    try {
        const result = await llmService.generateCompletion({
            provider,
            model,
            messages,
            jsonMode
        });
        res.json({ content: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Generate Research Plan (Specific helper)
app.post('/api/generate-plan', async (req, res) => {
    const { context, provider = 'deepseek', model } = req.body;

    // Construct the prompt (moved from frontend)
    const systemPrompt = `
    角色: 资深用户研究专家 & 商业分析师。
    任务: 基于详细的调研对象画像，生成一份专业的调研执行方案。
    请输出纯 JSON 格式，不要包含 Markdown 代码块。
    JSON 结构必须严格符合以下定义：
    {
      "title": "String, 调研计划标题",
      "logicOutline": "String, 调研逻辑大纲 (包含方法论应用)",
      "analysisFramework": "String, 分析体系 (将从哪些维度进行量化或定性分析)",
      "systemInstruction": "String, AI 访谈专家(Agent)的系统指令 (必须包含：1.人设与语气设定；2.开场白；3.核心指令：严格按照 questions 列表顺序提问，禁止发散无关话题，每个问题必须确认用户回答充分后才进行下一个，如果用户回答偏题需要礼貌引导回原问题)",
      "questions": [
        {
          "id": "String, unique id",
          "text": "String, 具体问题文本",
          "type": "String, 必须是 'open' 或 'scale' 或 'choice'",
          "intent": "String, 该问题的调研意图"
        }
      ]
    }`;

    const userPrompt = `
    调研对象画像:
    - 类型: ${context.objectType}
    - 行业: ${context.industry}
    - 基础属性: ${context.demographics}
    - 用户画像描述: ${context.userPersona}
    
    调研目标: ${context.objectives}
    执行方式: ${context.method === 'voice' ? 'AI 语音深度访谈' : '在线结构化问卷'}
    题目数量: 约 ${context.questionCount} 题
    `;

    try {
        const content = await llmService.generateCompletion({
            provider,
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            jsonMode: true
        });

        // Clean JSON if needed (simple check)
        let cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(cleaned);
        
        // --- Inject Fixed Questions (Industry, Gender, Age) ---
        const fixedQuestions = [
            { id: "fixed_industry", text: "您的行业是？", type: "choice", intent: "Demographics: Industry" },
            { id: "fixed_gender", text: "您的性别是？", type: "choice", intent: "Demographics: Gender" },
            { id: "fixed_age", text: "您的年龄是？", type: "choice", intent: "Demographics: Age" }
        ];

        // Ensure questions array exists
        if (!json.questions) json.questions = [];
        
        // Append to the end
        json.questions.push(...fixedQuestions);

        // --- Inject Default Voice Settings if Voice Method ---
        if (context.method === 'voice' && !json.voiceSettings) {
            json.voiceSettings = {
                gender: 'female',
                language: 'zh',
                tone: '温柔女声',
                voiceName: 'Kore' // Default match
            };
        }

        // Update System Instruction for Voice Agent
        if (json.systemInstruction) {
            json.systemInstruction += "\n\n[Important Requirement] You MUST ask the user for their Industry, Gender, and Age before ending the conversation, unless they have already provided this information naturally.";
            json.systemInstruction += "\n\n[Core Directive] You must strictly follow the provided 'questions' list. Do not generate irrelevant questions. Ensure each question is answered fully before moving to the next. If the user deviates, politely guide them back to the current question.";
        }
        
        res.json(json);
    } catch (error) {
        console.error("Plan generation error:", error);
        res.status(500).json({ error: error.message || "Failed to generate plan" });
    }
});

// 2.1 Refine Plan
app.post('/api/refine-plan', async (req, res) => {
    const { currentPlan, instructions, provider = 'deepseek', model } = req.body;
    
    const prompt = `
    任务: 优化现有的调研计划。
    
    用户反馈/修改意见: "${instructions}"
    
    当前计划内容 (JSON):
    ${JSON.stringify(currentPlan)}

    请根据修改意见，重新调整逻辑大纲、分析体系、系统指令和问题列表。
    必须保持 JSON 结构与输入完全一致。
    
    **特别注意**: 如果修改涉及系统指令(System Instruction)，请务必保留“自然、生活化、语速轻快、拒绝播音腔”的语气设定。
    
    请输出纯 JSON 格式。
    `;

    try {
        const content = await llmService.generateCompletion({
            provider,
            model,
            messages: [{ role: 'user', content: prompt }],
            jsonMode: true
        });

        let cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(cleaned);

        // --- Maintain Fixed Questions ---
        const fixedIds = ["fixed_industry", "fixed_gender", "fixed_age"];
        const fixedQuestions = [
            { id: "fixed_industry", text: "您的行业是？", type: "choice", intent: "Demographics: Industry" },
            { id: "fixed_gender", text: "您的性别是？", type: "choice", intent: "Demographics: Gender" },
            { id: "fixed_age", text: "您的年龄是？", type: "choice", intent: "Demographics: Age" }
        ];

        if (!json.questions) json.questions = [];
        
        // Filter out any potential duplicates or LLM-hallucinated versions of these fixed IDs
        json.questions = json.questions.filter(q => !fixedIds.includes(q.id));
        
        // Re-append to ensure they exist and are at the end
        json.questions.push(...fixedQuestions);

        // Update System Instruction
        if (json.systemInstruction && !json.systemInstruction.includes("Industry, Gender, and Age")) {
            json.systemInstruction += "\n\n[Important Requirement] You MUST ask the user for their Industry, Gender, and Age before ending the conversation, unless they have already provided this information naturally.";
        }

        if (json.systemInstruction && !json.systemInstruction.includes("Core Directive")) {
             json.systemInstruction += "\n\n[Core Directive] You must strictly follow the provided 'questions' list. Do not generate irrelevant questions. Ensure each question is answered fully before moving to the next. If the user deviates, politely guide them back to the current question.";
        }

        res.json(json);
    } catch (error) {
        console.error("Refine error:", error);
        res.status(500).json({ error: error.message || "Failed to refine plan" });
    }
});

// 2.2 Analyze Transcripts
app.post('/api/analyze', async (req, res) => {
    const { transcript, provider = 'deepseek', model } = req.body;
    
    const prompt = `
    任务: 分析用户访谈记录。
    
    访谈记录:
    ${transcript}
    
    请输出 JSON 格式的分析报告:
    {
      "summary": "核心洞察摘要 (Markdown)",
      "sentiment": [{"name": "Positive", "value": 60, "color": "#34C759"}, ...],
      "keywords": [{"word": "价格", "count": 12}, ...],
      "themes": [{"topic": "产品体验", "count": 5}, ...]
    }
    `;

    try {
        const content = await llmService.generateCompletion({
            provider,
            model,
            messages: [{ role: 'user', content: prompt }],
            jsonMode: true
        });
        
        let cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(cleaned);
        res.json(json);
    } catch (error) {
        console.error("Analysis error:", error);
        res.status(500).json({ error: error.message || "Failed to analyze" });
    }
});

// 3. Session Management
app.get('/api/sessions', (req, res) => {
    try {
        const sessions = getSessions();
        // Convert map to array
        const sessionList = Object.values(sessions);
        res.json(sessionList);
    } catch (error) {
        console.error("Get all sessions error:", error);
        res.status(500).json({ error: "Failed to get sessions" });
    }
});

app.get('/api/sessions/:id', (req, res) => {
    try {
        const sessions = getSessions();
        const session = sessions[req.params.id];
        if (session) {
            res.json(session);
        } else {
            res.status(404).json({ error: 'Session not found' });
        }
    } catch (error) {
        console.error("Get session error:", error);
        res.status(500).json({ error: "Failed to get session" });
    }
});

app.post('/api/sessions/:id', (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
        saveSession(id, data);
        res.json({ success: true });
    } catch (error) {
        console.error("Save session error:", error);
        res.status(500).json({ error: "Failed to save session" });
    }
});

// 4. Share Link Generation (Simple)
app.post('/api/share', (req, res) => {
    const { sessionId } = req.body;
    // In a real app, you might generate a short token.
    // Here we just verify the session exists and return the public URL structure.
    const sessions = getSessions();
    if (!sessions[sessionId]) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    // Assuming frontend is served on port 5173 or deployed domain
    // The user can configure the public base URL
    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:5173';
    const link = `${baseUrl}/interview/${sessionId}`;
    
    res.json({ link });
});

// 5. Generate Project Report
app.post('/api/generate-project-report', async (req, res) => {
    const { projectTitle, sessions, provider = 'deepseek', model } = req.body;

    if (!sessions || sessions.length === 0) {
        return res.status(400).json({ error: "No sessions provided" });
    }

    // Prepare context from sessions
    const sessionSummaries = sessions.map((s, idx) => {
        const analysis = s.analysis ? JSON.stringify(s.analysis) : "Not analyzed";
        const transcript = s.transcript ? s.transcript.substring(0, 2000) : "No transcript"; // Truncate for safety
        return `Session ${idx + 1} (${s.context.userPersona}):\nAnalysis: ${analysis}\nTranscript Excerpt: ${transcript}\n---`;
    }).join('\n');

    const prompt = `
    角色: 资深商业分析师
    任务: 为项目 "${projectTitle}" 生成一份深度研究报告。
    
    输入数据 (多位用户的访谈摘要):
    ${sessionSummaries}
    
    请输出 JSON 格式的报告，结构如下:
    {
      "chapters": [
        {
          "title": "章节标题 (如：核心发现)",
          "content": "章节详细内容 (Markdown格式，支持表格、列表，不少于300字)",
          "keyTakeaways": ["关键点1", "关键点2", "关键点3"]
        },
        {
          "title": "用户画像分析",
          "content": "Markdown内容...",
          "keyTakeaways": []
        },
        {
          "title": "需求痛点挖掘",
          "content": "Markdown内容...",
          "keyTakeaways": []
        },
        {
          "title": "商业建议与机会",
          "content": "Markdown内容...",
          "keyTakeaways": []
        }
      ]
    }
    `;

    try {
        const content = await llmService.generateCompletion({
            provider,
            model,
            messages: [{ role: 'user', content: prompt }],
            jsonMode: true
        });

        let cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(cleaned);
        res.json(json);
    } catch (error) {
        console.error("Project report generation error:", error);
        res.status(500).json({ error: error.message || "Failed to generate report" });
    }
});

// --- Serve Frontend Static Files (Production) ---
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    console.log('Serving static files from', distPath);
    app.use(express.static(distPath));

    // Handle client-side routing, return all requests to index.html
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
             res.sendFile(path.join(distPath, 'index.html'));
        }
    });
}

// Global Error Handlers
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
