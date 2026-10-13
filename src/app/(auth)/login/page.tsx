"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { login, saveTokens, saveUser, verifyLoginOtp } from "@/lib/auth";
import { PasswordField } from "@/components/common/PasswordField";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"login" | "otp">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const loginInFlightRef = useRef(false);
  const verifyInFlightRef = useRef(false);

  useEffect(() => {
    if (localStorage.getItem("accessToken")) {
      router.replace("/checklist");
    }
  }, [router]);

  const clearFeedback = () => {
    setError("");
    setMessage("");
  };

  const onLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (loginInFlightRef.current) return;

    const normalizedEmail = email.trim().toLowerCase();
    loginInFlightRef.current = true;
    clearFeedback();
    setIsLoading(true);

    try {
      const result = await login(normalizedEmail, password);
      setEmail(result.email || normalizedEmail);
      setMessage(result.message || `Mã OTP đã được gửi tới ${normalizedEmail}.`);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      loginInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const onVerifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (verifyInFlightRef.current) return;

    const normalizedEmail = email.trim().toLowerCase();
    verifyInFlightRef.current = true;
    clearFeedback();
    setIsLoading(true);

    try {
      const result = await verifyLoginOtp(normalizedEmail, otp);
      saveTokens(result.accessToken, result.refreshToken);
      saveUser(result.user);
      window.location.replace("/checklist");
    } catch (err) {
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
  };

  return (
    <main className="auth-page">
      <section className="auth-aside">
        <div className="auth-aside-content">
          <div className="auth-kicker">QUẢN LÝ CÔNG VIỆC</div>
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
            <div className="auth-brand">ViecPro</div>
            <h1>{step === "login" ? "Chào mừng trở lại" : "Xác minh đăng nhập"}</h1>
            <p className="auth-card-subtitle">
              {step === "login"
                ? "Đăng nhập để tiếp tục công việc của bạn."
                : `Nhập mã 6 chữ số đã gửi tới ${email}.`}
            </p>
          </div>

          {message ? <div className="auth-alert auth-alert-success">{message}</div> : null}
          {error ? <div className="auth-alert auth-alert-error">{error}</div> : null}

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

              <div className="auth-link-row">
                <span />
                <button type="button" className="auth-text-button" onClick={() => router.push("/forgot-password")}>
                  Quên mật khẩu?
                </button>
              </div>

              <button type="submit" disabled={isLoading} className="auth-primary">
                {isLoading ? "Đang gửi mã..." : "Tiếp tục"}
              </button>
            </form>
          ) : (
            <form onSubmit={onVerifyOtp} className="auth-form">
              <label className="auth-label">
                Mã xác minh OTP
                <input
                  className="auth-input auth-input-otp"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                  placeholder="000000"
                  maxLength={6}
                />
              </label>

              <p className="auth-step-note">Kiểm tra cả thư mục Spam nếu bạn chưa thấy email.</p>

              <button type="submit" disabled={isLoading || otp.length !== 6} className="auth-primary">
                {isLoading ? "Đang xác minh..." : "Xác nhận và đăng nhập"}
              </button>
              <button type="button" disabled={isLoading} className="auth-secondary" onClick={returnToLogin}>
                Dùng email khác
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
