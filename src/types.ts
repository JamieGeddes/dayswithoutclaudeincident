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

export interface State {
  latestIncidents: StoredIncident[];
  longestStreakDays: number;
  longestStreakStart: string;
  longestStreakEnd: string;
  lastUpdatedAt: string;
}
