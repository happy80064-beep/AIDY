const llmService = require('./llmService');
const dotenv = require('dotenv');
dotenv.config();

async function test() {
    try {
        const result = await llmService.generateCompletion({
            provider: 'gemini',
            model: 'gemini-1.5-flash',
            messages: [{ role: 'user', content: 'Say hello' }]
        });
        console.log("Success:", result);
    } catch (e) {
        console.error("Failed:", e.message);
    }
}

test();
