import { describe, expect, it } from "vitest";
import { categoryCounts, cleanAlerts, cleanSteps, dayCounts, exportText, groupByCategory, monthGrid } from "./taskExtras";

describe("taskExtras", () => {
  it("cleans checklist steps", () => {
    const out = cleanSteps([{ id: "a", text: " one ", done: 1 }, { id: "b", text: "  " }]);
    expect(out).toEqual([{ id: "a", text: "one", done: true }]);
  });
  it("sorts alerts and keeps null as default", () => {
    expect(cleanAlerts([10, 1440])).toEqual([1440, 10]);
    expect(cleanAlerts(null)).toBe(null);
  });
  it("counts and groups categories", () => {
    const tasks = [{ category: "A" }, { category: "B" }, { category: "A" }, { category: "B", deleted: true }];
    expect(categoryCounts(tasks)).toEqual([{ name: "A", count: 2 }, { name: "B", count: 1 }]);
    expect(groupByCategory(tasks)[0].label).toBe("A");
  });
  it("builds a Monday-first month grid", () => {
    const g = monthGrid(2026, 10);
    expect(g.length % 7).toBe(0);
    expect(g.indexOf(1)).toBe(6);
  });
  it("counts pending reminders per IST day", () => {
    const out = dayCounts([{ status: "pending", due_date: "2026-11-20T10:00:00Z" }, { status: "completed", due_date: "2026-11-20T10:00:00Z" }]);
    expect(out["2026-11-20"]).toBe(1);
  });
  it("exports every reminder with its steps", () => {
    const text = exportText([{ title: "Pay fees", status: "pending", due_date: "2026-11-20T10:00:00Z", subtasks: [{ text: "ask dad", done: false }] }]);
    expect(text).toContain("[ ] Pay fees");
    expect(text).toContain("[ ] ask dad");
  });
});
