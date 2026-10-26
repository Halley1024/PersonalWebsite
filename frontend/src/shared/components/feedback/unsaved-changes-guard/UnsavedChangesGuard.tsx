import { useEffect, type RefObject } from "react";
import { useBlocker } from "react-router-dom";
import { Dialog } from "../../ui/dialog/Dialog";
import { Button } from "../../ui/button/Button";
export function UnsavedChangesGuard({
  dirty,
  allowNavigation,
}: {
  dirty: boolean;
  allowNavigation?: RefObject<boolean>;
}) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (allowNavigation?.current) {
      allowNavigation.current = false;
      return false;
    }
    return (
      dirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search)
    );
  });
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return (
    <Dialog
      open={blocker.state === "blocked"}
      title="有尚未保存的修改"
      onClose={() => blocker.state === "blocked" && blocker.reset()}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => blocker.state === "blocked" && blocker.reset()}
          >
            继续编辑
          </Button>
          <Button
            onClick={() => blocker.state === "blocked" && blocker.proceed()}
          >
            离开页面
          </Button>
        </>
      }
    >
      <p>
        服务器尚未保存这些修改。本标签页会暂时保留表单内容，刷新或关闭页面后无法恢复。
      </p>
    </Dialog>
  );
}
