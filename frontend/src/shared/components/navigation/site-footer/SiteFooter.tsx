import { Link } from "react-router-dom";
import { usePublicSettings } from "../../../queries/settings";
import styles from "./SiteFooter.module.css";
export function SiteFooter() {
  const { data } = usePublicSettings();
  return (
    <footer className={styles.footer}>
      <span>{data?.footer_text || "记录思考，持续构建。"}</span>
      <div>
        <Link to="/about">关于与联系</Link>
        <Link to="/admin/login">站点管理</Link>
      </div>
      <span>
        © {new Date().getFullYear()} {data?.site_name || "个人网站"}
      </span>
    </footer>
  );
}
