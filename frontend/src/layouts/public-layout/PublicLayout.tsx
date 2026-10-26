import type { NavigationItem } from "../../shared/components/navigation/types";
import { Outlet } from "react-router-dom";
import { SiteHeader } from "../../shared/components/navigation/site-header/SiteHeader";
import { SiteFooter } from "../../shared/components/navigation/site-footer/SiteFooter";
import { ParticleBackground } from "../../shared/components/background/particle-background/ParticleBackground";
import styles from "./PublicLayout.module.css";
export default function PublicLayout({
  navigation,
}: {
  navigation: NavigationItem[];
}) {
  return (
    <div className={styles.layout}>
      <ParticleBackground />
      <a href="#main" className="skip-link">
        跳到正文
      </a>
      <SiteHeader items={navigation} />
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
