import { useMemo } from "react";
import { bucketTasks, groupByIstDay, progressPercent } from "../pages/dashboard/buckets";
import { getIstDayRange } from "../utils/date";

/** Groups the offline reminders for the dashboard and computes today's progress. */
export default function useDashboardTasks(tasks) {
  return useMemo(() => {
    const now = Date.now();
    const groups = bucketTasks(tasks, getIstDayRange(now));
    return {
      ...groups,
      upcomingGroups: groupByIstDay(groups.upcoming, now),
      doneTodayCount: groups.doneToday,
      progressPct: progressPercent(groups.doneToday, groups.today.length),
    };
  }, [tasks]);
}
