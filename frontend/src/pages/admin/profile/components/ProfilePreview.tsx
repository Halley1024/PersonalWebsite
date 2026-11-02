import { useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import type { AdminProfile, ProfileUpdate, PublicProfile } from "../../../../shared/api/generated";
import { ProfileOverview } from "../../../public/about/components/ProfileOverview";
import styles from "./ProfilePreview.module.css";
export function ProfilePreview({ value, initial, dirty }: { value: ProfileUpdate; initial: AdminProfile; dirty: boolean }) {
  const previewRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const preview = previewRef.current;
    const viewport = viewportRef.current;
    if (!preview || !viewport) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.deltaY === 0) return;
      const inside = event.target instanceof Node && viewport.contains(event.target);
      const canScroll = event.deltaY < 0 ? viewport.scrollTop > 0
        : viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 1;
      // Use native scrolling inside the preview; prevent wheel input from moving the page.
      if (!inside || !canScroll) event.preventDefault();
    };
    preview.addEventListener("wheel", onWheel, { passive: false });
    return () => preview.removeEventListener("wheel", onWheel);
  }, []);
  const profile: PublicProfile = {
    ...value,
    skill_groups: value.skill_groups.map((group) => ({ ...group, items: group.items.filter((item) => item.trim()) })).filter((group) => group.title.trim() || group.items.length),
    avatar: value.avatar_media_id
      ? initial.avatar?.id === value.avatar_media_id ? initial.avatar
        : { id: value.avatar_media_id, url: `/api/v1/media/${value.avatar_media_id}`, width: 96, height: 96, alt: value.display_name }
      : null,
  };
  return <aside ref={previewRef} className={styles.preview} aria-label="关于我页面实时预览">
    <header className={styles.heading}><div><span>LIVE PREVIEW</span><h2>展示预览</h2></div><a href="/about" target="_blank" rel="noopener noreferrer">查看公开页面<ExternalLink size={14} /></a></header>
    <div className={styles.browser}><div className={styles.browserBar}><span aria-hidden="true"><i /><i /><i /></span><span>/about</span><small>{dirty ? "未保存预览" : "当前资料"}</small></div>
      <div ref={viewportRef} className={styles.viewport} tabIndex={0} role="region" aria-label="关于我页面预览内容">
        <ProfileOverview profile={profile} compact />
      </div>
    </div>
    <p className={styles.hint}>左侧修改会实时显示在这里，保存后更新公开页面。</p>
  </aside>;
}
