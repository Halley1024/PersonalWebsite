import {
  LayoutDashboard,
  FileText,
  FolderGit2,
  Camera,
  Users,
  ShieldBan,
  UserRound,
  Milestone,
  Tags,
  Image,
  Settings,
} from "lucide-react";
import type {
  NavigationItem,
  AdminNavigationItem,
} from "../shared/components/navigation/types";
export const publicNav: NavigationItem[] = [
  { to: "/", label: "首页" },
  { to: "/about", label: "关于" },
  { to: "/posts", label: "博客" },
  { to: "/projects", label: "作品" },
  { to: "/life", label: "生活" },
];
export const adminNav: AdminNavigationItem[] = [
  { to: "/admin", label: "流量总览", icon: LayoutDashboard, end: true },
  { to: "/admin/visits", label: "访问明细", icon: Users },
  { to: "/admin/access-rules", label: "访问规则", icon: ShieldBan },
  { to: "/admin/profile", label: "个人资料", icon: UserRound },
  { to: "/admin/experiences", label: "经历时间线", icon: Milestone },
  { to: "/admin/contents", label: "全部内容", icon: FileText },
  { to: "/admin/contents?kind=blog", label: "技术博客", icon: FileText },
  { to: "/admin/contents?kind=project", label: "项目作品", icon: FolderGit2 },
  { to: "/admin/contents?kind=life", label: "生活记录", icon: Camera },
  { to: "/admin/taxonomy", label: "分类与标签", icon: Tags },
  { to: "/admin/media", label: "媒体库", icon: Image },
  { to: "/admin/settings", label: "站点设置", icon: Settings },
];
