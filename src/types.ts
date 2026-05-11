export interface Incident {
  title: string;
  link: string;
  pubDate: Date;
}

export interface StoredIncident {
  pubDate: string;
  title: string;
  link: string;
}

export interface StreakRecord {
  days: number;
  startDate: string;
  endDate: string;
}

export interface SiteState {
  lastIncident: {
    pubDate: string;
    concurrent: StoredIncident[];
  };
  historicalLongestStreak: StreakRecord | null;
  lastUpdatedAt: string;
}
