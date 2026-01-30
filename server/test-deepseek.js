const dotenv = require('dotenv');
dotenv.config();
const llmService = require('./llmService');

async function testDeepSeek() {
    console.log("Testing DeepSeek...");
    try {
        const result = await llmService.generateCompletion({
            provider: 'deepseek',
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: 'Hello' }]
        });
        console.log("DeepSeek Success:", result);
    } catch (e) {
        console.error("DeepSeek Failed:", e.message);
    }
}

testDeepSeek();
