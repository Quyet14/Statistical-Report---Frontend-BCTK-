"use client";

import { useRouter } from "next/navigation";
import { PasswordField } from "@/components/common/PasswordField";
import { FormEvent, useRef, useState } from "react";
import { forgotPassword, resetPassword } from "@/lib/auth";
import { useAuthCooldown } from "@/components/auth/useAuthCooldown";
import { clearClientSession } from "@/lib/session";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmedPassword, setConfirmedPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"request" | "reset">("request");
  const inFlight = useRef(false);
  const cooldown = useAuthCooldown();

  const clearFeedback = () => {
    setError("");
    setMessage("");
  };

  const handleRequestOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || cooldown.seconds > 0) return;
    inFlight.current = true;
    clearFeedback();
    setIsLoading(true);

    try {
      await forgotPassword(email);
      setEmail(email.trim().toLowerCase());
      setMessage("Nếu tài khoản đủ điều kiện, mã xác minh sẽ được gửi đến email bạn đã nhập.");
      setStep("reset");
    } catch (err) {
      cooldown.capture(err);
      setError(err instanceof Error ? err.message : "Gửi mã OTP thất bại");
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || cooldown.seconds > 0) return;
    clearFeedback();

    if (newPassword !== confirmedPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    inFlight.current = true;
    setIsLoading(true);

    try {
      await resetPassword(email, otp, newPassword);
      clearClientSession();
      setNewPassword(""); setConfirmedPassword(""); setOtp("");
      setMessage("Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.");
      setTimeout(() => router.replace("/login"), 900);
    } catch (err) {
      cooldown.capture(err);
      setError(err instanceof Error ? err.message : "Đổi mật khẩu thất bại");
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  };

  const requestAnotherOtp = () => {
    clearFeedback();
    setOtp("");
    setNewPassword("");
    setConfirmedPassword("");
    setStep("request");
  };

  return (
    <main className="auth-page">
      <section className="auth-aside">
        <div className="auth-aside-content">
          <div className="auth-kicker">ViecPro / Account recovery</div>
          <h2>Lấy lại quyền truy cập, nhẹ nhàng hơn.</h2>
          <p>Một mã xác minh gửi đến email là đủ để bạn trở lại nhịp làm việc an toàn.</p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-brand">ViecPro</div>
            <h1>{step === "request" ? "Quên mật khẩu?" : "Đặt mật khẩu mới"}</h1>
            <p className="auth-card-subtitle">
              {step === "request"
                ? "Nhập email công việc, chúng tôi sẽ gửi mã xác minh cho bạn."
                : `Nhập mã xác minh nhận qua email ${email}, nếu tài khoản đủ điều kiện.`}
            </p>
          </div>

          {cooldown.seconds > 0 ? <div className="auth-alert" role="status">Vui lòng thử lại sau {cooldown.seconds} giây.</div> : null}
          {message ? <div className="auth-alert auth-alert-success">{message}</div> : null}
          {error ? <div className="auth-alert auth-alert-error">{error}</div> : null}

          {step === "request" ? (
            <form onSubmit={handleRequestOtp} className="auth-form">
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

              <button type="submit" disabled={isLoading || cooldown.seconds > 0} className="auth-primary">
                {isLoading ? "Đang gửi mã..." : "Gửi mã xác minh"}
              </button>
              <button type="button" disabled={isLoading} className="auth-secondary" onClick={() => router.replace("/login")}>
                Quay lại đăng nhập
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="auth-form">
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

              <label className="auth-label">
                Mật khẩu mới
                <PasswordField
                  className="auth-input"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="Ít nhất 8 ký tự"
                />
              </label>

              <label className="auth-label">
                Xác nhận mật khẩu mới
                <PasswordField
                  className="auth-input"
                  value={confirmedPassword}
                  onChange={(event) => setConfirmedPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="Nhập lại mật khẩu mới"
                />
              </label>

              <button type="submit" disabled={isLoading || cooldown.seconds > 0 || otp.length !== 6} className="auth-primary">
                {isLoading ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
              </button>
              <div className="auth-link-row">
                <button type="button" disabled={isLoading || cooldown.seconds > 0} className="auth-text-button" onClick={requestAnotherOtp}>
                  Gửi mã khác
                </button>
                <button type="button" disabled={isLoading} className="auth-text-button" onClick={() => router.replace("/login")}>
                  Về đăng nhập
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
