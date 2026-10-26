import { ThemeToggle } from "../../shared/components/ui/theme-toggle/ThemeToggle";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, ArrowUpRight } from "lucide-react";
import { AdminSidebar } from "../../shared/components/navigation/admin-sidebar/AdminSidebar";
import { ConfirmDialog } from "../../shared/components/ui/confirm-dialog/ConfirmDialog";
import { useSession } from "../../shared/session/useSession";
import type { AdminNavigationItem } from "../../shared/components/navigation/types";
import { beijingDay } from "../../shared/utils/date";
import styles from "./AdminLayout.module.css";
export default function AdminLayout({
  navigation,
}: {
  navigation: AdminNavigationItem[];
}) {
  const [open, setOpen] = useState(false);
  const [logout, setLogout] = useState(false);
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const title =
    navigation.find((n) => n.to === location.pathname + location.search)
      ?.label ||
    navigation.find((n) => n.to.split("?")[0] === location.pathname)?.label ||
    "内容编辑";
  return (
    <div className={styles.layout}>
      <a href="#main" className="skip-link">
        跳到正文
      </a>
      <AdminSidebar
        items={navigation}
        open={open}
        onClose={() => setOpen(false)}
        onLogout={() => setLogout(true)}
      />
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div>
            <button
              className={styles.menu}
              onClick={() => setOpen(true)}
              aria-label="打开后台菜单"
            >
              <Menu size={21} />
            </button>
            <span>网站管理</span>
            <i>/</i>
            <strong>{title}</strong>
          </div>
          <div>
            <ThemeToggle />
            <time>{beijingDay()}</time>
            <a href="/" target="_blank" rel="noopener noreferrer">
              查看网站
              <ArrowUpRight size={13} />
            </a>
          </div>
        </header>
        <main id="main" className={styles.main}>
          <Outlet />
        </main>
        <footer className={styles.footer}>
          CONTENT STUDIO <span>所有修改以服务器保存结果为准</span>
        </footer>
      </div>
      <ConfirmDialog
        open={logout}
        title="退出管理后台"
        description="退出会撤销当前会话。尚未保存的修改不会写入服务器，请先确认已保存。"
        confirmText="退出登录"
        onClose={() => setLogout(false)}
        onConfirm={async () => {
          await session.logout();
          navigate("/admin/login", { replace: true });
        }}
      />
    </div>
  );
}
