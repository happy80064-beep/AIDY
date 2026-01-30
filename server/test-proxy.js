const dotenv = require('dotenv');
dotenv.config();

async function testProxy() {
    const apiKey = process.env.GEMINI_API_KEY;
    const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
    // Remove trailing slash if present
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const model = 'gemini-1.5-flash';
    const url = `${cleanBaseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    console.log(`Testing Proxy URL: ${url}`);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "Hello, are you working?" }]
                }]
            })
        });

        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error("Response body:", text);
        } else {
            const data = await response.json();
            console.log("Success! Response:");
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

testProxy();
