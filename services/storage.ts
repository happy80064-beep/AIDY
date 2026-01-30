import { ResearchPlan, ResearchContext, AnalysisResult, ProjectReport } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

export interface SessionData {
  id: string;
  plan: ResearchPlan;
  context: ResearchContext;
  transcript?: string;
  analysis?: AnalysisResult;
  timestamp: number;
}

export const saveSession = async (data: SessionData) => {
  // 1. Always save to LocalStorage for redundancy/local speed
  try {
    localStorage.setItem(`insightflow_${data.id}`, JSON.stringify(data));
  } catch (e) {
    console.error("LocalStorage save failed", e);
  }

  // 2. Save to Backend
  try {
      await fetch(`${API_BASE_URL}/sessions/${data.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      });
  } catch (e) {
      console.error("Backend save failed", e);
  }
};

export const getSession = async (id: string): Promise<SessionData | null> => {
  // 1. Try Backend first (latest source of truth for shared sessions)
  try {
      const response = await fetch(`${API_BASE_URL}/sessions/${id}`);
      if (response.ok) {
          const data = await response.json();
          // Sync back to local
          localStorage.setItem(`insightflow_${id}`, JSON.stringify(data));
          return data;
      }
  } catch (e) {
      console.warn("Backend fetch failed, trying local", e);
  }

  // 2. Fallback to LocalStorage
  const local = localStorage.getItem(`insightflow_${id}`);
  if (local) {
    return JSON.parse(local) as SessionData;
  }

  return null;
};

export const getAllSessions = async (): Promise<SessionData[]> => {
  const sessions: SessionData[] = [];
  const ids = new Set<string>();

  // 1. Fetch from Backend
  try {
      const response = await fetch(`${API_BASE_URL}/sessions`);
      if (response.ok) {
          const backendSessions = await response.json();
          if (Array.isArray(backendSessions)) {
              backendSessions.forEach((s: any) => {
                  if (s && s.id) {
                      if (!s.timestamp) s.timestamp = 0;
                      sessions.push(s);
                      ids.add(s.id);
                  }
              });
          }
      }
  } catch (e) {
      console.warn("Backend fetch all failed", e);
  }

  // 2. Fetch from LocalStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('insightflow_')) {
        const id = key.replace('insightflow_', '');
        if (!ids.has(id)) {
             try {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') {
                        // Ensure timestamp exists, default to 0 if missing to avoid sort errors
                        if (!parsed.timestamp) parsed.timestamp = 0;
                        sessions.push(parsed);
                        ids.add(id);
                    }
                }
             } catch(e) {}
        }
    }
  }

  return sessions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
};

// --- Project Report Storage ---
// (Mocking this for now as backend doesn't support reports yet, or just use LocalStorage)
export const saveProjectReport = async (projectTitle: string, report: ProjectReport) => {
    try {
        localStorage.setItem(`insightflow_report_${projectTitle}`, JSON.stringify(report));
    } catch (e) {
        console.error("Report save failed", e);
    }
};

export const getProjectReport = async (projectTitle: string): Promise<ProjectReport | null> => {
    try {
        const raw = localStorage.getItem(`insightflow_report_${projectTitle}`);
        if (raw) {
            return JSON.parse(raw) as ProjectReport;
        }
    } catch (e) {
        console.error("Report fetch failed", e);
    }
    return null;
};
