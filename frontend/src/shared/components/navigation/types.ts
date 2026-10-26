import type { LucideIcon } from "lucide-react";
export type NavigationItem = { to: string; label: string; end?: boolean };
export type AdminNavigationItem = NavigationItem & { icon: LucideIcon };
