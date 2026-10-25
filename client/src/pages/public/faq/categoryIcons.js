import { BellRing, LayoutGrid, ListTodo, Rocket, SlidersHorizontal, UserCog } from "lucide-react";

export const CATEGORY_ICONS = {
  All: LayoutGrid,
  "Getting Started": Rocket,
  Tasks: ListTodo,
  Notifications: BellRing,
  "Settings & Offline": SlidersHorizontal,
  "Account & Privacy": UserCog,
};

export const iconForCategory = (category) => CATEGORY_ICONS[category] || LayoutGrid;
