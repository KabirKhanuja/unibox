export type RawEmail = {
  id: string;
  subject: string;
  from: string;
  date: string;
  body?: string;
  snippet?: string;
  permalink?: string;
};

export type NormalizedEmail = {
  id: string;
  subject: string;
  from: string;
  date: string;
  text: string; 
  permalink?: string;
};

export type EnrichedEmail = NormalizedEmail & {
  summary: string;
  importanceScore: number;
};