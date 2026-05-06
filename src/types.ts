export interface Incident {
  title: string;
  link: string;
  pubDate: Date;
}

export interface State {
  lastIncident: {
    pubDate: string;
    title: string;
    link: string;
  };
  longestStreakDays: number;
  lastUpdatedAt: string;
}
