import { generatePlan, refinePlan, analyzeTranscriptsAPI, generateProjectReportAPI } from './api';
import { ResearchContext, ResearchPlan } from '../types';

export const generateResearchPlan = async (context: ResearchContext): Promise<ResearchPlan> => {
  const plan = await generatePlan(context);
  // Inject provider info so Interview component knows which model to use
  return {
      ...plan,
      provider: context.provider,
      model: context.model
  };
};

export const refineResearchPlan = async (currentPlan: ResearchPlan, refineInstructions: string): Promise<ResearchPlan> => {
  return await refinePlan(currentPlan, refineInstructions);
};

export const analyzeTranscripts = async (transcript: string) => {
    return await analyzeTranscriptsAPI(transcript);
}

export const generateProjectReport = async (projectTitle: string, sessions: any[]) => {
    return await generateProjectReportAPI(projectTitle, sessions);
}
