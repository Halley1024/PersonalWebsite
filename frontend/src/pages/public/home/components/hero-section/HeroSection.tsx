import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { PublicProfile } from "../../../../../shared/api/generated";
import { ContactDialog } from "../../../../../shared/components/profile/contact-dialog/ContactDialog";
import { Terminal } from "./Terminal";
import styles from "./HeroSection.module.css";
export function HeroSection({ profile }: { profile: PublicProfile }) {
  const [contact, setContact] = useState(false);
  return (
    <section className={styles.hero}>
      <div>
        <div className={styles.eyebrow}>
          <i />
          TECHNOLOGY · PROJECTS · LIFE
        </div>
        <h1>
          你好，我是
          <br />
          <span>{profile.display_name}</span>
          <span className={styles.dot}>.</span>
        </h1>
        <p className={styles.role}>
          {profile.headline || "记录思考，把想法变成作品。"}
        </p>
        <p className={styles.intro}>
          {profile.intro ||
            "欢迎来到我的个人空间。这里记录技术探索、项目实践，以及生活中的点滴。"}
        </p>
        <div className={styles.actions}>
          <Link
            to="/projects"
            className={`${styles.heroButton} ${styles.primaryButton}`}
          >
            查看我的作品
            <ArrowRight size={15} />
          </Link>
          <button
            type="button"
            className={`${styles.heroButton} ${styles.ghostButton}`}
            onClick={() => setContact(true)}
          >
            保持联系
            <ArrowUpRight size={15} />
          </button>
        </div>
        <div className={styles.bottom}>
          <span>LEARN. BUILD. SHARE.</span>
          <span>向下探索 ↓</span>
        </div>
      </div>
      <Terminal profile={profile} />
      <ContactDialog
        open={contact}
        onClose={() => setContact(false)}
        profile={profile}
      />
    </section>
  );
}
