import { Mail, ArrowUpRight } from "lucide-react";
import { Dialog } from "../../ui/dialog/Dialog";
import type { PublicProfile } from "../../../api/generated";
import { safeLink } from "../../../utils/url";
import styles from "./ContactDialog.module.css";
export function ContactDialog({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: PublicProfile;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="保持联系">
      <p className={styles.description}>关于技术、项目，或新的想法。</p>
      <div className={styles.links}>
        {profile.public_email && (
          <a href={`mailto:${profile.public_email}`}>
            <Mail size={18} />
            {profile.public_email}
            <ArrowUpRight size={16} />
          </a>
        )}
        {profile.social_links
          .filter((l) => safeLink(l.url))
          .map((l, i) => (
            <a
              key={i}
              href={safeLink(l.url)}
              target={l.url.startsWith("https:") ? "_blank" : undefined}
              rel="noopener noreferrer"
            >
              {l.label}
              <ArrowUpRight size={16} />
            </a>
          ))}
        {!profile.public_email && !profile.social_links.length && (
          <p>站主尚未公开联系方式。</p>
        )}
      </div>
    </Dialog>
  );
}
