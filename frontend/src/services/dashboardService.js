import {
  activities,
  activityPeriods,
  constituency,
  mapLocations,
  panchayats,
} from "../data/mockDashboardData";

export function getDashboardData() {
  return { activities, activityPeriods, constituency, mapLocations, panchayats };
}

export function filterRecordsBySearch(records, query, fields) {
  const normalize = (value) => String(value ?? "").toLocaleLowerCase().replace(/[,\s]/g, "");
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return records;

  return records.filter((record) =>
    fields.some((field) => normalize(record[field]).includes(normalizedQuery))
  );
}

export function filterActivities(records, query, period, now = Date.now()) {
  const selectedPeriod = activityPeriods.find(({ value }) => value === period);
  if (!selectedPeriod) {
    throw new Error(`Unknown activity period: ${period}`);
  }

  const cutoff = now - selectedPeriod.durationMs;
  const inPeriod = records.filter((record) => {
    const occurredAt = Date.parse(record.occurredAt);
    if (Number.isNaN(occurredAt)) {
      throw new Error(`Invalid activity timestamp for "${record.id}"`);
    }
    return occurredAt >= cutoff && occurredAt <= now;
  });
  return filterRecordsBySearch(inPeriod, query, ["title", "subtitle"]);
}

export function summarizePanchayats(records) {
  const summary = records.reduce(
    (totals, record) => {
      totals.booths += record.booths;
      totals.voters += record.voters;
      totals.workers += record.workers;
      totals.progress += record.progress;
      totals.statusCounts[record.status] = (totals.statusCounts[record.status] ?? 0) + 1;
      return totals;
    },
    { booths: 0, voters: 0, workers: 0, progress: 0, statusCounts: {} }
  );

  return {
    panchayatCount: records.length,
    boothCount: summary.booths,
    voterCount: summary.voters,
    workerCount: summary.workers,
    averageProgress: records.length ? Math.round(summary.progress / records.length) : 0,
    statusCounts: summary.statusCounts,
  };
}

export function formatRelativeTime(value, now = Date.now()) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Invalid activity timestamp: ${value}`);
  }
  const elapsedMinutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
}
