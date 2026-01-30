const API_BASE_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

export const generatePlan = async (context: any) => {
  const response = await fetch(`${API_BASE_URL}/generate-plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      context,
      provider: context.provider || 'deepseek', // Default to deepseek
      model: context.model
    }),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
};

export const generateChatCompletion = async (
  provider: string, 
  messages: any[], 
  model?: string,
  jsonMode: boolean = false
) => {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider,
      model,
      messages,
      jsonMode
    }),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.content;
};

export const saveSession = async (id: string, data: any) => {
    // Save to local backend
    await fetch(`${API_BASE_URL}/sessions/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
};

export const getSession = async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/sessions/${id}`);
    if (response.ok) return response.json();
    return null;
};

export const generateShareLink = async (sessionId: string) => {
    const response = await fetch(`${API_BASE_URL}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
    });
    if (response.ok) return response.json();
    throw new Error("Failed to generate link");
};

export const refinePlan = async (currentPlan: any, instructions: string) => {
    const response = await fetch(`${API_BASE_URL}/refine-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            currentPlan, 
            instructions,
            provider: currentPlan.provider || 'deepseek',
            model: currentPlan.model 
        })
    });
    if (!response.ok) throw new Error("Refine failed");
    return response.json();
};

export const analyzeTranscriptsAPI = async (transcript: string) => {
    // We assume default provider for analysis if not tracked, or use hardcoded
    const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            transcript,
            provider: 'deepseek' // Default for analysis
        })
    });
    if (!response.ok) throw new Error("Analysis failed");
    return response.json();
};

export const generateProjectReportAPI = async (projectTitle: string, sessions: any[]) => {
    const response = await fetch(`${API_BASE_URL}/generate-project-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            projectTitle, 
            sessions,
            provider: 'deepseek' // Default or passed in
        })
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Report generation failed");
    }
    return response.json();
};
