import { Link } from "react-router-dom";
import styles from "./StatusView.module.css";
export function StatusView({ forbidden = false }: { forbidden?: boolean }) {
  return (
    <section className={styles.view}>
      <span>{forbidden ? "403 / ACCESS DENIED" : "404 / NOT FOUND"}</span>
      <h1>{forbidden ? "暂时无法访问" : "这一页，还没有留下足迹。"}</h1>
      <p>
        {forbidden
          ? "当前访问受到限制。如有疑问，请联系站点管理员。"
          : "链接可能已经失效，或内容尚未公开。去其他地方看看吧。"}
      </p>
      <Link to="/">返回首页 ↗</Link>
    </section>
  );
}
