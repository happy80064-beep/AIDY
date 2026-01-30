const OpenAI = require('openai');
const dotenv = require('dotenv');

dotenv.config();

const PROVIDERS = {
    'deepseek': {
        baseURL: 'https://api.deepseek.com',
        apiKeyEnv: 'DEEPSEEK_API_KEY',
        defaultModel: 'deepseek-chat'
    },
    'qwen': {
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKeyEnv: 'QWEN_API_KEY',
        defaultModel: 'qwen-turbo'
    },
    'zhipu': {
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        apiKeyEnv: 'ZHIPU_API_KEY',
        defaultModel: 'glm-4'
    },
    'doubao': {
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        apiKeyEnv: 'ARK_API_KEY',
        defaultModel: 'ep-20240604060406-abcde' // User needs to replace this with their endpoint ID
    },
    'gemini': {
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKeyEnv: 'GEMINI_API_KEY',
        defaultModel: 'gemini-1.5-flash'
    }
};

class LLMService {
    constructor() {
        this.clients = {};
    }

    getClient(provider) {
        if (this.clients[provider]) {
            return this.clients[provider];
        }

        const config = PROVIDERS[provider];
        if (!config) {
            throw new Error(`Provider ${provider} not supported`);
        }

        const apiKey = process.env[config.apiKeyEnv];
        if (!apiKey) {
            throw new Error(`API key for ${provider} not found in environment variables`);
        }

        const client = new OpenAI({
            baseURL: config.baseURL,
            apiKey: apiKey,
        });

        this.clients[provider] = client;
        return client;
    }

    async generateCompletion({ provider, model, messages, jsonMode = false }) {
        console.log(`Generating completion with ${provider} / ${model}`);
        
        if (provider === 'gemini') {
            return this.generateGeminiCompletion(model, messages, jsonMode);
        }

        const client = this.getClient(provider);
        const config = PROVIDERS[provider];
        
        try {
            const completion = await client.chat.completions.create({
                messages,
                model: model || config.defaultModel,
                response_format: jsonMode ? { type: "json_object" } : undefined,
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error(`Error calling ${provider}:`, error);
            throw error;
        }
    }

    async generateGeminiCompletion(model, messages, jsonMode) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not found");

        let systemInstruction = undefined;
        const contents = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemInstruction = { parts: [{ text: msg.content }] };
            } else {
                contents.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                });
            }
        }

        const targetModel = model || 'gemini-1.5-flash';
        const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
        const url = `${baseUrl}/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;
        
        const body = {
            contents,
            systemInstruction,
            generationConfig: {
                responseMimeType: jsonMode ? "application/json" : "text/plain"
            }
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                // Check for location error or specific 404 that implies it
                if (errorText.includes("User location is not supported") || 
                   (response.status === 404 && errorText.includes("is not found for API version"))) {
                    throw new Error("Gemini API failed. This is likely due to Region Blocking (GFW). Please use a proxy or switch to domestic models like DeepSeek/Qwen.");
                }
                throw new Error(`Gemini API Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } catch (error) {
             console.error(`Error calling gemini:`, error);
             throw error;
        }
    }
}

module.exports = new LLMService();
