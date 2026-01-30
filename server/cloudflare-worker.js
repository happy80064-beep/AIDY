/**
 * Cloudflare Worker for Proxying Google Gemini API
 * 
 * Instructions:
 * 1. Log in to Cloudflare Dashboard (https://dash.cloudflare.com/)
 * 2. Go to "Workers & Pages" -> "Create Application" -> "Create Worker"
 * 3. Name your worker (e.g., "gemini-proxy") and click "Deploy"
 * 4. Click "Edit code"
 * 5. Replace the existing code with the code below
 * 6. Click "Deploy" on the top right
 * 7. Copy the worker URL (e.g., https://gemini-proxy.your-name.workers.dev)
 * 8. Paste this URL into your server/.env file as GEMINI_BASE_URL
 */

export default {
  async fetch(request, env, ctx) {
    // Target Google's Gemini API
    const TARGET_HOST = 'generativelanguage.googleapis.com';
    
    const url = new URL(request.url);
    url.hostname = TARGET_HOST;
    url.protocol = 'https:';
    url.port = '443';

    // Create a new request with the modified URL
    // We clone the original request to preserve body, method, headers, etc.
    const newRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow'
    });

    // Fetch from Google
    try {
      const response = await fetch(newRequest);
      
      // Return the response directly
      // You can add CORS headers here if needed, but the backend handles CORS usually
      return response;
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  },
};
