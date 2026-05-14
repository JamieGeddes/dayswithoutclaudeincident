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

export interface CalendarDay {
  date: string;
  count: number;
  incidents: StoredIncident[];
}

export interface CalendarState {
  days: Record<string, CalendarDay>;
  firstDate: string;
  lastUpdatedAt: string;
}
