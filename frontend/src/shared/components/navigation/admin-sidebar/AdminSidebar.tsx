import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, LogOut, X } from "lucide-react";
import type { AdminNavigationItem } from "../types";
import { useSession } from "../../../session/useSession";
import styles from "./AdminSidebar.module.css";
export function AdminSidebar({
  open,
  onClose,
  onLogout,
  items,
}: {
  items: AdminNavigationItem[];
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  const { session } = useSession();
  const { pathname, search } = useLocation();
  return (
    <>
      {open && (
        <button
          className={styles.overlay}
          aria-label="关闭侧栏"
          onClick={onClose}
        />
      )}
      <aside
        className={`${styles.sidebar} ${open ? styles.open : ""}`}
        aria-label="后台导航"
      >
        <Link to="/admin" className={styles.brand}>
          <span>&gt;_</span>
          <div>
            CONTENT STUDIO<small>PERSONAL WORKSPACE</small>
          </div>
        </Link>
        <button
          className={styles.close}
          aria-label="关闭侧栏"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <div className={styles.workspace}>
          <i />
          个人内容工作台<span>v1.0</span>
        </div>
        <p className={styles.label}>WORKSPACE / 工作空间</p>
        <nav>
          {items.map((n, i) => {
            const [to, query] = n.to.split("?");
            const active = n.end
              ? pathname === to
              : pathname.startsWith(to) &&
                (query
                  ? new URLSearchParams(search).get("kind") ===
                    new URLSearchParams(query).get("kind")
                  : to !== "/admin/contents" ||
                    !new URLSearchParams(search).has("kind"));
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={onClose}
                className={`${styles.link} ${active ? styles.active : ""} ${i === 6 ? styles.separated : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <n.icon size={17} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className={styles.bottom}>
          <Link to="/">
            查看公开网站
            <ArrowUpRight size={15} />
          </Link>
          <div className={styles.identity}>
            <span className={styles.avatar}>
              {session?.authenticated
                ? session.admin.username.slice(0, 1).toUpperCase()
                : "A"}
            </span>
            <div>
              <strong>
                {session?.authenticated ? session.admin.username : "管理员"}
              </strong>
              <small>站点管理员</small>
            </div>
            <button aria-label="退出登录" title="退出登录" onClick={onLogout}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
