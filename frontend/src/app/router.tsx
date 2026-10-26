import {
  createBrowserRouter,
  Link,
  useRouteError,
  isRouteErrorResponse,
  Outlet,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";
import { RequireSession } from "../shared/session/RequireSession";
import { ErrorNotice } from "../shared/components/ui/error-notice/ErrorNotice";

function RouteError() {
  const error = useRouteError();
  return (
    <div style={{ padding: "60px 24px", maxWidth: 900, margin: "auto" }}>
      <h1>页面暂时无法显示</h1>
      <ErrorNotice
        error={
          isRouteErrorResponse(error)
            ? new Error(`${error.status} ${error.statusText}`)
            : error
        }
      />
      <p>
        <Link to="/">返回首页</Link>
      </p>
      <button onClick={() => window.location.reload()}>重新加载</button>
    </div>
  );
}
function Root() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const robots =
      document.querySelector<HTMLMetaElement>("meta[name=robots]") ??
      document.head.appendChild(
        Object.assign(document.createElement("meta"), { name: "robots" }),
      );
    robots.content = pathname.startsWith("/admin")
      ? "noindex,nofollow"
      : "index,follow";
  }, [pathname]);
  return <Outlet />;
}
const public_posts_list = async () => ({
  Component: (await import("../pages/public/posts/list/Page")).default,
});
const public_posts_detail = async () => ({
  Component: (await import("../pages/public/posts/detail/Page")).default,
});
const public_projects_list = async () => ({
  Component: (await import("../pages/public/projects/list/Page")).default,
});
const public_projects_detail = async () => ({
  Component: (await import("../pages/public/projects/detail/Page")).default,
});
const public_life_list = async () => ({
  Component: (await import("../pages/public/life/list/Page")).default,
});
const public_life_detail = async () => ({
  Component: (await import("../pages/public/life/detail/Page")).default,
});
const admin_login = async () => ({
  Component: (await import("../pages/admin/login/Page")).default,
});
const admin_dashboard = async () => ({
  Component: (await import("../pages/admin/dashboard/Page")).default,
});
const admin_visits = async () => ({
  Component: (await import("../pages/admin/visits/Page")).default,
});
const admin_access_rules = async () => ({
  Component: (await import("../pages/admin/access-rules/Page")).default,
});
const admin_profile = async () => ({
  Component: (await import("../pages/admin/profile/Page")).default,
});
const admin_experiences = async () => ({
  Component: (await import("../pages/admin/experiences/Page")).default,
});
const admin_contents_list = async () => ({
  Component: (await import("../pages/admin/contents/list/Page")).default,
});
const admin_contents_create = async () => ({
  Component: (await import("../pages/admin/contents/create/Page")).default,
});
const admin_contents_edit = async () => ({
  Component: (await import("../pages/admin/contents/edit/Page")).default,
});
const admin_taxonomy = async () => ({
  Component: (await import("../pages/admin/taxonomy/Page")).default,
});
const admin_media = async () => ({
  Component: (await import("../pages/admin/media/Page")).default,
});
const admin_settings = async () => ({
  Component: (await import("../pages/admin/settings/Page")).default,
});
const errors_not_found = async () => ({
  Component: (await import("../pages/errors/not-found/Page")).default,
});
const public_home = async () => ({
  Component: (await import("../pages/public/home/Page")).default,
});
const public_about = async () => ({
  Component: (await import("../pages/public/about/Page")).default,
});

export const router = createBrowserRouter([
  {
    Component: Root,
    errorElement: <RouteError />,
    HydrateFallback: () => (
      <div role="status" style={{ padding: 48, color: "var(--dim)" }}>
        正在加载页面…
      </div>
    ),
    children: [
      {
        lazy: async () => {
          const [{ default: Layout }, { publicNav }] = await Promise.all([
            import("../layouts/public-layout/PublicLayout"),
            import("./navigation"),
          ]);
          return { Component: () => <Layout navigation={publicNav} /> };
        },
        children: [
          { index: true, lazy: public_home },
          { path: "about", lazy: public_about },
          { path: "posts", lazy: public_posts_list },
          { path: "posts/:slug", lazy: public_posts_detail },
          { path: "projects", lazy: public_projects_list },
          { path: "projects/:slug", lazy: public_projects_detail },
          { path: "life", lazy: public_life_list },
          { path: "life/:slug", lazy: public_life_detail },
        ],
      },
      { path: "admin/login", lazy: admin_login },
      {
        Component: RequireSession,
        children: [
          {
            path: "admin",
            lazy: async () => {
              const [{ default: Layout }, { adminNav }] = await Promise.all([
                import("../layouts/admin-layout/AdminLayout"),
                import("./navigation"),
              ]);
              return { Component: () => <Layout navigation={adminNav} /> };
            },
            children: [
              { index: true, lazy: admin_dashboard },
              { path: "visits", lazy: admin_visits },
              { path: "access-rules", lazy: admin_access_rules },
              { path: "profile", lazy: admin_profile },
              { path: "experiences", lazy: admin_experiences },
              { path: "contents", lazy: admin_contents_list },
              { path: "contents/new", lazy: admin_contents_create },
              { path: "contents/:id/edit", lazy: admin_contents_edit },
              { path: "taxonomy", lazy: admin_taxonomy },
              { path: "media", lazy: admin_media },
              { path: "settings", lazy: admin_settings },
              { path: "*", lazy: errors_not_found },
            ],
          },
        ],
      },
      {
        lazy: async () => {
          const [{ default: Layout }, { publicNav }] = await Promise.all([
            import("../layouts/public-layout/PublicLayout"),
            import("./navigation"),
          ]);
          return { Component: () => <Layout navigation={publicNav} /> };
        },
        children: [{ path: "*", lazy: errors_not_found }],
      },
    ],
  },
]);
