import { MapPin } from "lucide-react";
import type { PublicProfile } from "../../../../shared/api/generated";
import { MarkdownRenderer } from "../../../../shared/components/content/markdown-renderer/MarkdownRenderer";
import styles from "./ProfileOverview.module.css";
export function ProfileOverview({ profile, compact = false }: { profile: PublicProfile; compact?: boolean }) {
  return (
    <section className={`${styles.profile} ${compact ? styles.compact : ""}`}>
      <header className={styles.heading}>
        <p className={styles.label}>01 / About</p>
        <h1>关于我</h1>
      </header>
      <div className={styles.identity}>
        {profile.avatar ? (
          <img
            src={profile.avatar.url}
            alt={profile.avatar.alt || profile.display_name}
            width={96}
            height={96}
          />
        ) : (
          <div className={styles.avatar}>
            {profile.display_name.slice(0, 1)}
          </div>
        )}
        <div>
          <h2>{profile.display_name}</h2>
          <p>{profile.headline}</p>
          {profile.location_label && (
            <small>
              <MapPin size={12} />
              {profile.location_label}
            </small>
          )}
        </div>
      </div>
      {profile.intro && <p className={styles.intro}>{profile.intro}</p>}
      {profile.bio_markdown ? (
        <div className={styles.bio}>
          <MarkdownRenderer value={profile.bio_markdown} />
        </div>
      ) : (
        <p className={styles.muted}>个人介绍尚未填写。</p>
      )}
      <div className={styles.stats}>
        {[
          ["experience", "年开发经验"],
          ["projects", "开源 / 落地项目"],
          ["notes", "技术笔记"],
        ].map(
          ([key, label]) =>
            profile.stats[key as keyof typeof profile.stats] && (
              <div key={key}>
                <strong>
                  {profile.stats[key as keyof typeof profile.stats]}
                </strong>
                <span>{label}</span>
              </div>
            ),
        )}
      </div>
      {profile.skill_groups.length > 0 && (
        <div className={styles.skills}>
          <p className={styles.label}>Core Stack</p>
          {profile.skill_groups.map((group, i) => (
            <section key={i}>
              <h3>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {group.title}
              </h3>
              <div>
                {group.items.map((item, j) => (
                  <span key={j}>{item}</span>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
