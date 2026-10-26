import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { usePublicSettings } from "../queries/settings";
export function useSeo(title: string, description?: string) {
  const { pathname } = useLocation();
  const settings = usePublicSettings();
  useEffect(() => {
    const name = settings.data?.site_name || "个人网站";
    document.title = title ? `${title} · ${name}` : name;
    const meta =
      document.querySelector<HTMLMetaElement>("meta[name=description]") ??
      document.head.appendChild(
        Object.assign(document.createElement("meta"), { name: "description" }),
      );
    meta.content = description ?? settings.data?.site_description ?? "";
    const link =
      document.querySelector<HTMLLinkElement>("link[rel=canonical]") ??
      document.head.appendChild(
        Object.assign(document.createElement("link"), { rel: "canonical" }),
      );
    link.href = window.location.origin + pathname;
    const robots =
      document.querySelector<HTMLMetaElement>("meta[name=robots]") ??
      document.head.appendChild(
        Object.assign(document.createElement("meta"), { name: "robots" }),
      );
    robots.content = pathname.startsWith("/admin")
      ? "noindex,nofollow"
      : "index,follow";
  }, [title, description, settings.data, pathname]);
}
