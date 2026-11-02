import { useEffect, useState } from "react";
import type { PublicProfile } from "../../../../../shared/api/generated";
import styles from "./Terminal.module.css";

type Segment = { text: string; className?: string };
type TerminalLine = { segments: Segment[]; output?: boolean; blockEnd?: boolean };

export function Terminal({ profile }: { profile: PublicProfile }) {
  const username = profile.display_name.trim().toLowerCase().replace(/\s+/g, "-") || "visitor";
  const command = (text: string): TerminalLine => ({
    segments: [
      { text: `${username}@dev`, className: styles.prompt },
      { text: ":", className: styles.separator },
      { text: "~", className: styles.path },
      { text: "$ ", className: styles.separator },
      { text },
    ],
  });
  const skills = profile.skill_groups.slice(0, 3);
  const lines: TerminalLine[] = [
    command("whoami"),
    { segments: [{ text: profile.display_name }], output: true },
    { segments: [{ text: profile.headline || "持续学习，持续构建" }], blockEnd: true },
    command("ls ~/skills/"),
    ...(skills.length ? skills.map((group, index): TerminalLine => ({
      segments: [{ text: `${group.title}/${group.items.length ? `  ${group.items.slice(0, 3).join(" · ")}` : ""}` }],
      output: index === 0,
      blockEnd: index === skills.length - 1,
    })) : [{ segments: [{ text: "持续探索，持续学习。" }], output: true, blockEnd: true }]),
    command("cat motto.txt"),
    { segments: [{ text: "build, ship, iterate." }], output: true, blockEnd: true },
    command(""),
  ];
  const transcript = lines.map((line) => line.segments.map((segment) => segment.text).join("")).join("\n");
  const [typing, setTyping] = useState({ transcript: "", count: 0 });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyping({ transcript, count: transcript.length });
      return;
    }
    let count = 0;
    setTyping({ transcript, count: 0 });
    const timer = setInterval(() => {
      count += 1;
      setTyping({ transcript, count });
      if (count >= transcript.length) clearInterval(timer);
    }, 35);
    return () => clearInterval(timer);
  }, [transcript]);

  const printed = typing.transcript === transcript ? typing.count : 0;
  let offset = 0;

  return (
    <section className={styles.terminal} aria-label="个人资料终端视图">
      <div className={styles.bar}>
        <div className={styles.dots} aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <span className={styles.title}>{username}@dev: ~ — bash</span>
      </div>
      <div className={styles.body}>
        {lines.map((line, lineIndex) => {
          const className = [styles.line, line.output && styles.output, line.blockEnd && styles.blockEnd].filter(Boolean).join(" ");
          const content = line.segments.map((segment, segmentIndex) => {
            const characters = segment.text;
            const visible = Math.max(0, Math.min(characters.length, printed - offset));
            const atLineEnd = segmentIndex === line.segments.length - 1 && printed === offset + characters.length;
            const active = printed >= offset && (printed < offset + characters.length || atLineEnd);
            offset += characters.length;
            return (
              <span key={segmentIndex} className={segment.className}>
                {characters.slice(0, visible)}
                {active && <span className={styles.caret} aria-hidden="true" />}
                <span className={styles.pending} aria-hidden="true">{characters.slice(visible)}</span>
              </span>
            );
          });
          offset += 1;
          return (
            <p key={lineIndex} className={className}>
              {content}
            </p>
          );
        })}
      </div>
    </section>
  );
}
