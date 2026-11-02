import { Mail, ArrowUpRight, ArrowRight, Github, Globe } from "lucide-react";
import { Dialog } from "../../ui/dialog/Dialog";
import type { PublicProfile } from "../../../api/generated";
import { contactMethods, type ContactMethod } from "./contacts";
import styles from "./ContactDialog.module.css";

function ContactIcon({ kind }: { kind: ContactMethod["kind"] }) {
  if (kind === "email") return <Mail size={20} />;
  if (kind === "github") return <Github size={20} />;
  if (kind === "bilibili") return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="15" rx="3" /><path d="m8 2 3 4m5-4-3 4M8 11v3m8-3v3m-7 3h6" /></svg>;
  return <Globe size={20} />;
}

export function ContactDialog({ open, onClose, profile }: {
  open: boolean;
  onClose: () => void;
  profile: PublicProfile;
}) {
  const methods = contactMethods(profile);
  return (
    <Dialog open={open} onClose={onClose} title="联系我" variant="contact"
      eyebrow="LET’S CONNECT" description="交流技术、分享想法，或聊聊新的合作。">
      <div className={styles.methods}>
        {methods.map((method, index) => {
          const content = <>
            <span className={styles.icon} aria-hidden="true"><ContactIcon kind={method.kind} /></span>
            <span className={styles.info}><span className={styles.label}>{method.label}</span><span className={styles.value}>{method.value}</span></span>
            {method.href && <span className={styles.arrow} aria-hidden="true">{method.kind === "email" ? <ArrowRight size={16} /> : <ArrowUpRight size={16} />}</span>}
          </>;
          return method.href ? <a className={styles.method} key={index} href={method.href}
            target={method.kind === "email" ? undefined : "_blank"} rel={method.kind === "email" ? undefined : "noopener noreferrer"}>{content}</a>
            : <div className={styles.method} key={index} aria-disabled="true">{content}</div>;
        })}
      </div>
    </Dialog>
  );
}
