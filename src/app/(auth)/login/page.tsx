"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AuthRequestError, refreshCurrentUser, login, saveUser, verifyLoginOtp, forgetDevice } from "@/lib/auth";
import { useAuthCooldown } from "@/components/auth/useAuthCooldown";
import { clearClientSession } from "@/lib/session";
import { PasswordField } from "@/components/common/PasswordField";
import { WorkspaceSculpture } from "@/components/common/WorkspaceSculpture";
import { OtpInput } from "@/components/common/OtpInput";
import { maskEmail } from "@/lib/auth-display";
import { requestJson } from "@/lib/http";
import { startSessionActivity } from "@/lib/session-activity";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [device, setDevice] = useState<{ remembered: boolean; autoLogin: boolean }>({ remembered: false, autoLogin: false });
  const [idleLock, setIdleLock] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const captchaInFlight = useRef(false);
  const [step, setStep] = useState<"login" | "otp">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const loginInFlightRef = useRef(false);
  const verifyInFlightRef = useRef(false);
  const cooldown = useAuthCooldown();

  async function loadCaptcha() {
    if (captchaInFlight.current) return;
    captchaInFlight.current = true;
    setCaptchaLoading(true);
    setCaptcha("");
    setCaptchaImage("");
    try {
      const result = await requestJson<{ image: string }>("/auth/captcha", {}, false);
      setCaptchaImage(result.image);
    } catch (reason) { cooldown.capture(reason); setError(reason instanceof Error ? reason.message : "Không tải được mã CAPTCHA."); }
    finally { setCaptchaLoading(false); captchaInFlight.current = false; }
  }
  useEffect(() => { void loadCaptcha(); }, []);
  useEffect(() => {
    let cancelled = false;
    void requestJson<{ remembered: boolean; autoLogin: boolean }>("/auth/device-status", { method: "POST", body: "{}" }, false).then(result => { if (!cancelled) { setDevice(result); if (result.remembered) setRememberDevice(true); } }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    clearClientSession();
    if (new URLSearchParams(window.location.search).get("reason") === "idle") { setIdleLock(true); setMessage("Phiên đã tạm khóa do không hoạt động. Bạn có thể tiếp tục trên thiết bị đã ghi nhớ hoặc đăng nhập lại."); return; }
    void refreshCurrentUser().then(() => {
      if (!cancelled) router.replace("/checklist");
    }).catch((reason: unknown) => {
      cooldown.capture(reason);
      if (!cancelled && !(reason instanceof AuthRequestError && (reason.status === 401 || reason.status === 403))) {
        setError("Không thể kết nối để kiểm tra phiên đăng nhập. Vui lòng thử lại.");
      }
    });
    return () => { cancelled = true; };
  }, [router]);

  const clearFeedback = () => {
    setError("");
    setMessage("");
  };

  const onLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (loginInFlightRef.current || cooldown.seconds > 0) return;

    const normalizedEmail = email.trim().toLowerCase();
    loginInFlightRef.current = true;
    clearFeedback();
    setIsLoading(true);

    try {
      const result = await login(normalizedEmail, password, captcha, rememberDevice);
      if ("authenticated" in result && result.authenticated) { saveUser(result.user); startSessionActivity(); window.location.replace("/checklist"); return; }
      if (!("email" in result)) throw new Error("Phản hồi đăng nhập không hợp lệ.");
      setEmail(result.email || normalizedEmail);
      setMessage("Mã xác minh có hiệu lực trong 5 phút. Vui lòng kiểm tra hộp thư của bạn.");
      setStep("otp");
      setPassword("");
    } catch (err) {
      cooldown.capture(err);
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
      void loadCaptcha();
    } finally {
      loginInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const onVerifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (verifyInFlightRef.current || cooldown.seconds > 0) return;

    const normalizedEmail = email.trim().toLowerCase();
    verifyInFlightRef.current = true;
    clearFeedback();
    setIsLoading(true);

    try {
      const result = await verifyLoginOtp(normalizedEmail, otp, rememberDevice);
      saveUser(result.user);
      window.location.replace("/checklist");
    } catch (err) {
      cooldown.capture(err);
      setError(err instanceof Error ? err.message : "Xác minh OTP thất bại");
    } finally {
      verifyInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const returnToLogin = () => {
    clearFeedback();
    setOtp("");
    setStep("login");
    void loadCaptcha();
  };

  return (
    <main className="auth-page">
      <section className="auth-aside">
        <div className="auth-aside-content">
          <div className="auth-kicker">QUẢN LÝ CÔNG VIỆC</div>
          <WorkspaceSculpture />
          <h2>
             <span>Làm việc rõ ràng</span>
            <span>Hiệu suất bền vững</span>
          </h2>
          <p>Tập trung nhiệm vụ, theo dõi tiến độ và phối hợp hiệu quả trong một không gian làm việc thống nhất.</p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-header">
            <Image className="auth-logo" src="/hospital-logo.png" alt="Logo bệnh viện" width={72} height={72} priority />
            <div className="auth-brand">HuuNghi CareOps</div>
            <h1>{step === "login" ? "Chào mừng trở lại" : "Xác minh đăng nhập"}</h1>
            <p className="auth-card-subtitle">
              {step === "login"
                ? "Đăng nhập để tiếp tục công việc của bạn."
                : <>Nhập mã 6 chữ số đã gửi tới<br /><strong>{maskEmail(email)}</strong></>}
            </p>
          </div>

          {cooldown.seconds > 0 ? <div className="auth-alert" role="status">Vui lòng thử lại sau {cooldown.seconds} giây.</div> : null}
          {message ? <div className="auth-alert auth-alert-success">{message}</div> : null}
          {error ? <div className="auth-alert auth-alert-error">{error}</div> : null}
          {step === "login" && idleLock && device.remembered && device.autoLogin ? <button type="button" className="auth-primary" disabled={isLoading} onClick={async () => { setIsLoading(true); clearFeedback(); try { await refreshCurrentUser(); window.location.replace("/checklist"); } catch (reason) { setError(reason instanceof Error ? reason.message : "Vui lòng đăng nhập lại."); } finally { setIsLoading(false); } }}>Tiếp tục trên thiết bị này</button> : null}

          {step === "login" ? (
            <form onSubmit={onLogin} className="auth-form">
              <label className="auth-label">
                Email công việc
                <input
                  className="auth-input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="ten@congty.vn"
                />
              </label>

              <label className="auth-label">
                Mật khẩu
                <PasswordField
                  className="auth-input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="Nhập mật khẩu"
                />
              </label>

              <div className="auth-captcha">
                <label className="auth-label" htmlFor="login-captcha">Mã xác nhận</label>
                <div className="captcha-preview">
                  {captchaImage ? <img src={captchaImage} alt="Ảnh mã CAPTCHA gồm 6 ký tự" width={210} height={56} /> : <span role="status">{captchaLoading ? "Đang tải mã…" : "Chưa tải được mã"}</span>}
                  <button type="button" className="auth-text-button" disabled={captchaLoading || isLoading || cooldown.seconds > 0} onClick={() => void loadCaptcha()} aria-label="Đổi mã CAPTCHA">↻ Đổi mã</button>
                </div>
                <input id="login-captcha" className="auth-input captcha-answer" value={captcha} onChange={event => setCaptcha(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6))} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="Nhập 6 ký tự trong ảnh" maxLength={6} required aria-describedby="captcha-note" />
                <small id="captcha-note" className="auth-step-note">Không phân biệt chữ hoa, chữ thường.</small>
              </div>

              <div className="auth-link-row">
                <span />
                <button type="button" className="auth-text-button" onClick={() => router.push("/forgot-password")}>
                  Quên mật khẩu?
                </button>
              </div>

              <label className="remember-device-option"><input type="checkbox" checked={rememberDevice} onChange={event => setRememberDevice(event.target.checked)} /><span><strong>Ghi nhớ thiết bị cá nhân này</strong><small>Tự vào lại và bỏ qua OTP trên thiết bị này trong 30 ngày. Không chọn trên máy dùng chung.</small></span></label>

              <button type="submit" disabled={isLoading || cooldown.seconds > 0 || captchaLoading || !captchaImage || captcha.length !== 6} className="auth-primary">
                {isLoading ? "Đang gửi mã..." : "Tiếp tục"}
              </button>
            </form>
          ) : (
            <form onSubmit={onVerifyOtp} className="auth-form">
              <div className="auth-label">Mã xác minh OTP</div>
              <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />

              <p className="auth-step-note">Kiểm tra cả thư mục Spam nếu bạn chưa thấy email.</p>

              <button type="submit" disabled={isLoading || cooldown.seconds > 0 || !/^\d{6}$/.test(otp)} className="auth-primary">
                {isLoading ? "Đang xác minh..." : "Xác nhận và đăng nhập"}
              </button>
              <button type="button" disabled={isLoading} className="auth-secondary" onClick={returnToLogin}>
                Dùng email khác
              </button>
            </form>
          )}
          {step === "login" && device.remembered ? <button type="button" className="auth-text-button forget-device-link" disabled={isLoading} onClick={async () => { setIsLoading(true); try { await forgetDevice(); setDevice({ remembered: false, autoLogin: false }); setRememberDevice(false); setIdleLock(false); setMessage("Đã hủy ghi nhớ thiết bị. Lần đăng nhập tiếp theo sẽ cần OTP."); } catch (reason) { setError(reason instanceof Error ? reason.message : "Chưa thể hủy ghi nhớ."); } finally { setIsLoading(false); } }}>Quên thiết bị này</button> : null}
        </div>
      </section>
    </main>
  );
}
