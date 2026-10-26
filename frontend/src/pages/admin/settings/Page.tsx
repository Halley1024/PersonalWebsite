import { useAdminSettings } from "../../../shared/queries/settings";
import { useSeo } from "../../../shared/hooks/useSeo";
import { PageHeading } from "../../../shared/components/ui/page-heading/PageHeading";
import { Panel } from "../../../shared/components/ui/panel/Panel";
import { QueryState } from "../../../shared/components/ui/query-state/QueryState";
import { SettingsForm } from "./components/SettingsForm";
import { PasswordForm } from "./components/PasswordForm";
import styles from "./Page.module.css";
export default function Page() {
  const query = useAdminSettings();
  useSeo("站点设置");
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="SETTINGS / WEBSITE"
        title="站点设置"
        description="维护公开站点信息与管理员密码。"
      />
      <div className={styles.grid}>
        <Panel title="公开信息">
          <QueryState
            loading={query.isPending}
            error={query.error}
            retry={() => void query.refetch()}
          >
            {query.data && <SettingsForm initial={query.data} />}
          </QueryState>
        </Panel>
        <Panel title="账号安全">
          <PasswordForm />
        </Panel>
      </div>
    </div>
  );
}
