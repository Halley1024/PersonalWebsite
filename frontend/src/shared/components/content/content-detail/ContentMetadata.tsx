import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { PublicDetail } from "../../../api/generated";
import { date } from "../../../utils/date";
import { categoryNames, kindNames, stateNames } from "../../../utils/content";
import { safeLink } from "../../../utils/url";
import type { ExternalLink } from "./reading";
import styles from "./ContentDetail.module.css";

export function ContentMetadata({ item }: { item: PublicDetail }) {
  const project = item.project;
  const stack = project?.tech_stack || item.tech_stack || [];
  const category = categoryNames(item) || "未分类";
  const occurred = item.life?.occurred_on || item.occurred_on || item.published_at;
  const location = item.life?.location_label || item.location_label;
  const repository = project?.repository_url && safeLink(project.repository_url);
  const demo = project?.demo_url && safeLink(project.demo_url);
  return (
    <section className={styles.infoCard} aria-label="正文元信息">
      <p className={styles.kicker}>{item.kind.toUpperCase()} / DETAILS</p>
      <h2>{kindNames[item.kind]}信息</h2>
      <dl className={styles.facts}>
        {item.kind !== "project" && <div><dt>分类</dt><dd>{category}</dd></div>}
        {item.kind !== "project" && item.tags.length > 0 && (
          <div><dt>标签</dt><dd className={styles.badges}>{item.tags.map((tag) =>
            item.kind === "blog" ? <Link key={tag.id} to={`/posts?tag=${encodeURIComponent(tag.slug)}`}>{tag.name}</Link> : <span key={tag.id}>{tag.name}</span>,
          )}</dd></div>
        )}
        {item.kind === "project" && (
          <>
            <div><dt>技术栈</dt><dd className={styles.badges}>{stack.length ? stack.map((technology, index) => <span key={index}>{technology}</span>) : "暂未填写"}</dd></div>
            {project && <div><dt>项目状态</dt><dd>{stateNames[project.project_stage]}</dd></div>}
            <div><dt>项目时间</dt><dd>{date(project?.started_on || item.started_on)} — {(project?.ended_on || item.ended_on) ? date(project?.ended_on || item.ended_on) : "至今"}</dd></div>
            <div><dt>源码</dt><dd>{repository ? <a href={repository} target="_blank" rel="noopener noreferrer">查看源码 <ArrowUpRight size={13} /></a> : "暂未公开"}</dd></div>
            {demo && <div><dt>在线演示</dt><dd><a href={demo} target="_blank" rel="noopener noreferrer">访问演示 <ArrowUpRight size={13} /></a></dd></div>}
          </>
        )}
        {item.kind === "life" && <><div><dt>记录时间</dt><dd><time dateTime={occurred}>{date(occurred)}</time></dd></div><div><dt>地点</dt><dd>{location || "暂未公开"}</dd></div></>}
        <div><dt>发布时间</dt><dd><time dateTime={item.published_at}>{date(item.published_at)}</time></dd></div>
        <div><dt>更新于</dt><dd><time dateTime={item.updated_at}>{date(item.updated_at)}</time></dd></div>
      </dl>
    </section>
  );
}

export function ExternalLinks({ links }: { links: ExternalLink[] }) {
  if (!links.length) return null;
  return (
    <section className={styles.infoCard} aria-label="正文外部链接">
      <p className={styles.kicker}>LINKS / REFERENCES</p>
      <h2>外部链接</h2>
      <ul className={styles.externalLinks}>
        {links.map((link) => (
          <li key={link.href}><a href={link.href} target="_blank" rel="noopener noreferrer">
            <span>{link.title}<small>{link.host}</small></span><ArrowUpRight size={14} />
          </a></li>
        ))}
      </ul>
    </section>
  );
}
