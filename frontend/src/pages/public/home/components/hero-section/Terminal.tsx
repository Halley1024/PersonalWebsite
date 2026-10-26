import { useEffect, useState } from "react";
import type { PublicProfile } from "../../../../../shared/api/generated";
import styles from "./HeroSection.module.css";
export function Terminal({ profile }: { profile: PublicProfile }) {
  const lines = [
    `$ cat profile.json`,
    `  name: ${profile.display_name}`,
    `  role: ${profile.headline || "持续学习，持续构建"}`,
    ``,
    `$ ls interests/`,
    ...profile.skill_groups
      .slice(0, 3)
      .map((g) => `  ${g.title} / ${g.items.slice(0, 3).join(" · ")}`),
    ``,
    `$ echo "build, ship, iterate."`,
  ].join("\n");
  const [text, setText] = useState("");
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(lines);
      return;
    }
    let n = 0;
    setText("");
    const timer = setInterval(() => {
      n++;
      setText(lines.slice(0, n));
      if (n >= lines.length) clearInterval(timer);
    }, 35);
    return () => clearInterval(timer);
  }, [lines]);
  return (
    <div className={styles.terminal}>
      <div className={styles.terminalBar}>
        <div>
          <i />
          <i />
          <i />
        </div>
        <span>content / workspace</span>
        <span>⌘</span>
      </div>
      <pre aria-label="个人资料终端视图">
        <span>{text}</span>
        <span className={styles.caret}>▌</span>
      </pre>
      <div className={styles.terminalFoot}>
        <span>
          <i />
          来自公开资料
        </span>
        <span>UTF-8 / READ ONLY</span>
      </div>
    </div>
  );
}
