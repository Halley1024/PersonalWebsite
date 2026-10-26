import { ThemeToggle } from "../../../shared/components/ui/theme-toggle/ThemeToggle";
import { useState, type KeyboardEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { LoginInput } from "../../../shared/api/generated";
import { loginSchema } from "../../../shared/schemas/auth";
import { useSession } from "../../../shared/session/useSession";
import { safeReturnTo } from "../../../shared/utils/url";
import { useSeo } from "../../../shared/hooks/useSeo";
import { ErrorNotice } from "../../../shared/components/ui/error-notice/ErrorNotice";
import styles from "./Page.module.css";

function StudioWindow() {
  return (
    <div className={styles.studioWindow} aria-hidden="true">
      <div className={styles.windowBar}>
        <div className={styles.windowDots}>
          <i />
          <i />
          <i />
        </div>
        <span>~/halley/content-studio</span>
        <span className={styles.windowSymbol}>⌘</span>
      </div>
      <div className={styles.windowCode}>
        <div>
          <span className={styles.lineNumber}>01</span>
          <span className={styles.syntaxPurple}>const</span>
          {" studio "}
          <span className={styles.syntaxDim}>{"= {"}</span>
        </div>
        <div>
          <span className={styles.lineNumber}>02</span>
          {"  notes"}
          <span className={styles.syntaxDim}>:</span>{" "}
          <span className={styles.syntaxGreen}>{'"keep learning"'}</span>
          <span className={styles.syntaxDim}>,</span>
        </div>
        <div>
          <span className={styles.lineNumber}>03</span>
          {"  works"}
          <span className={styles.syntaxDim}>:</span>{" "}
          <span className={styles.syntaxGreen}>{'"keep building"'}</span>
          <span className={styles.syntaxDim}>,</span>
        </div>
        <div>
          <span className={styles.lineNumber}>04</span>
          {"  life"}
          <span className={styles.syntaxDim}>:</span>{" "}
          <span className={styles.syntaxGreen}>{'"keep exploring"'}</span>
        </div>
        <div>
          <span className={styles.lineNumber}>05</span>
          <span className={styles.syntaxDim}>{"};"}</span>
        </div>
        <div className={styles.codeComment}>
          <span className={styles.lineNumber}>06</span>
          {"// build, ship, iterate."}
        </div>
      </div>
      <div className={styles.windowStatus}>
        <span>
          <i />
          下一篇，从这里开始
        </span>
        <span>UTF-8</span>
      </div>
    </div>
  );
}

export default function Page() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<unknown>();
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const { errors, isSubmitting } = form.formState;
  const usernameField = form.register("username");
  const passwordField = form.register("password");
  useSeo("登录管理后台");
  const target = safeReturnTo(location.state?.returnTo);
  const updateCapsLock = (event: KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(event.getModifierState("CapsLock"));

  if (session.session?.authenticated) return <Navigate to={target} replace />;

  return (
    <div className={styles.page}>
      <a className="skip-link" href="#username">
        跳到登录表单
      </a>
      <div className={styles.ambient} aria-hidden="true" />
      <header className={styles.siteHeader}>
        <Link className={styles.brand} to="/" aria-label="Halley 首页">
          <span className={styles.brandMark}>H</span>
          <span>
            halley.dev<span className={styles.brandCursor}>_</span>
            <small>CONTENT STUDIO</small>
          </span>
        </Link>
        <div className={styles.headerActions}>
          <ThemeToggle />
          <Link className={styles.backToSite} to="/">
            返回公开站点 <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.loginLayout}>
          <section className={styles.brandStory} aria-labelledby="story-title">
            <div className={styles.eyebrow}>
              <span />
              YOUR SPACE TO CREATE
            </div>
            <h1 id="story-title">
              每一次<span>记录</span>，<br />
              都值得被看见<span className={styles.period}>.</span>
            </h1>
            <p className={styles.storyDescription}>
              整理技术、作品和日常，
              <br />
              把新的想法，变成下一次分享。
            </p>
            <StudioWindow />
            <div className={styles.storyFooter}>
              <span className={styles.storyLine} />
              <span>博客</span>
              <i />
              <span>作品</span>
              <i />
              <span>生活</span>
            </div>
          </section>

          <section className={styles.loginCard} aria-labelledby="login-title">
            <div className={styles.cardTopline}>
              <span className={styles.cardKicker}>ADMIN / SIGN IN</span>
              <span className={styles.accessMark}>
                <ShieldCheck aria-hidden="true" />
              </span>
            </div>
            <h2 id="login-title">
              欢迎回来<span>.</span>
            </h2>
            <p className={styles.loginDescription}>
              登录后，继续管理你的内容与网站。
            </p>
            <form
              noValidate
              onChange={() => setError(undefined)}
              onSubmit={form.handleSubmit(async (input) => {
                setError(undefined);
                try {
                  await session.login(input);
                  navigate(target, { replace: true });
                } catch (e) {
                  setError(e);
                }
              })}
            >
              <div className={styles.formField}>
                <label htmlFor="username">管理员账号</label>
                <div
                  className={`${styles.inputWrap} ${errors.username ? styles.invalid : ""}`}
                >
                  <UserRound className={styles.inputIcon} aria-hidden="true" />
                  <input
                    id="username"
                    type="text"
                    placeholder="请输入管理员账号"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={64}
                    readOnly={isSubmitting}
                    aria-invalid={!!errors.username}
                    aria-describedby="username-error"
                    {...usernameField}
                  />
                </div>
                <p
                  id="username-error"
                  className={styles.fieldError}
                  aria-live="polite"
                >
                  {errors.username?.message}
                </p>
              </div>
              <div className={styles.formField}>
                <label htmlFor="password">密码</label>
                <div
                  className={`${styles.inputWrap} ${errors.password ? styles.invalid : ""}`}
                >
                  <LockKeyhole
                    className={styles.inputIcon}
                    aria-hidden="true"
                  />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    maxLength={128}
                    readOnly={isSubmitting}
                    aria-invalid={!!errors.password}
                    aria-describedby="password-error caps-lock-warning"
                    {...passwordField}
                    onKeyDown={updateCapsLock}
                    onKeyUp={updateCapsLock}
                    onBlur={(event) => {
                      void passwordField.onBlur(event);
                      setCapsLock(false);
                    }}
                  />
                  <button
                    className={styles.passwordToggle}
                    type="button"
                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    aria-pressed={showPassword}
                    aria-controls="password"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" />
                    ) : (
                      <Eye aria-hidden="true" />
                    )}
                  </button>
                </div>
                <div className={styles.passwordHints}>
                  <p
                    id="password-error"
                    className={styles.fieldError}
                    aria-live="polite"
                  >
                    {errors.password?.message}
                  </p>
                  <p
                    id="caps-lock-warning"
                    className={styles.capsWarning}
                    hidden={!capsLock}
                  >
                    大写锁定已开启
                  </p>
                </div>
              </div>
              <div className={styles.formNote}>
                <LockKeyhole aria-hidden="true" />
                <span>仅限站点管理员访问</span>
              </div>
              <button
                className={styles.loginSubmit}
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting && (
                  <span className={styles.submitSpinner} aria-hidden="true" />
                )}
                <span className={styles.submitLabel}>
                  {isSubmitting ? "正在登录…" : "登录管理后台"}
                </span>
                <ArrowRight className={styles.submitArrow} aria-hidden="true" />
              </button>
              <ErrorNotice error={error} />
            </form>
            <div className={styles.publicEntry}>
              <Link to="/">
                浏览公开站点 <ArrowUpRight aria-hidden="true" />
              </Link>
              <span>PUBLIC SITE</span>
            </div>
            <p className={styles.supportNote}>记录想法，继续构建。</p>
          </section>
        </div>
      </main>
      <footer className={styles.siteFooter}>
        <span>HALLEY / CONTENT STUDIO</span>
        <span>© {new Date().getFullYear()} Halley · build, ship, iterate.</span>
      </footer>
    </div>
  );
}
