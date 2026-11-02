import { ThemeToggle } from "../../ui/theme-toggle/ThemeToggle";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import type { NavigationItem } from "../types";
import { usePublicProfile } from "../../../queries/profile";
import { ContactDialog } from "../../profile/contact-dialog/ContactDialog";
import styles from "./SiteHeader.module.css";
export function SiteHeader({ items }: { items: NavigationItem[] }) {
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState(false);
  const profile = usePublicProfile();
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.brand} aria-label="返回首页">
        <span className={styles.mark}>H</span>
        <span>
          {profile.data?.display_name || "halley"}
          <span className={styles.cursor}>_</span>
        </span>
      </Link>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.contactButton}
          disabled={!profile.data}
          onClick={() => {
            setOpen(false);
            setContact(true);
          }}
        >
          联系我
        </button>
        <ThemeToggle />
        <button
          className={styles.toggle}
          aria-label={open ? "关闭导航" : "打开导航"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <nav
        className={`${styles.nav} ${open ? styles.open : ""}`}
        aria-label="主导航"
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        {items.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            className={({ isActive }) => (isActive ? styles.active : undefined)}
            onClick={() => setOpen(false)}
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      {profile.data && (
        <ContactDialog
          open={contact}
          onClose={() => setContact(false)}
          profile={profile.data}
        />
      )}
    </header>
  );
}
