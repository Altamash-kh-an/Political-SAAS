const now = Date.now();

export const constituency = {
  name: "Nathnagar",
  district: "Bhagalpur",
  state: "Bihar",
};

export const panchayats = [
  { name: "Kajraili", booths: 14, voters: 12480, workers: 52, status: "Strong", progress: 86 },
  { name: "Bishanpur Jichho", booths: 12, voters: 10240, workers: 46, status: "Strong", progress: 79 },
  { name: "Bairia", booths: 11, voters: 9860, workers: 38, status: "Needs attention", progress: 54 },
  { name: "Raghunathpur", booths: 16, voters: 14120, workers: 61, status: "Moderate", progress: 68 },
  { name: "Madhopur", booths: 9, voters: 8450, workers: 32, status: "Strong", progress: 82 },
];

export const activities = [
  { id: "booth-report-034", title: "Booth report updated", subtitle: "Booth 034 · Kajraili Panchayat", occurredAt: new Date(now - 10 * 60 * 1000).toISOString(), icon: "report", color: "blue" },
  { id: "bairia-road-issue", title: "New issue reported", subtitle: "Road repair · Bairia Panchayat", occurredAt: new Date(now - 32 * 60 * 1000).toISOString(), icon: "issue", color: "orange" },
  { id: "raghunathpur-field-visit", title: "Field visit completed", subtitle: "Raghunathpur · Ward 08", occurredAt: new Date(now - 60 * 60 * 1000).toISOString(), icon: "completed", color: "green" },
  { id: "nathnagar-meeting", title: "Meeting scheduled", subtitle: "Worker coordination · Nathnagar", occurredAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(), icon: "meeting", color: "purple" },
];

export const activityPeriods = [
  { value: "1h", label: "Last hour", durationMs: 60 * 60 * 1000 },
  { value: "24h", label: "Last 24 hours", durationMs: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "Last 7 days", durationMs: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "Last 30 days", durationMs: 30 * 24 * 60 * 60 * 1000 },
];

export const mapLocations = [
  { name: "Nathnagar", position: "pin-one" },
  { name: "Kajraili", position: "pin-two" },
  { name: "Bairia", position: "pin-three" },
  { name: "Madhopur", position: "pin-four" },
];
