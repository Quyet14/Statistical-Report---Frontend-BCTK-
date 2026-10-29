"use client";
import { useRef } from "react";
export function OtpInput({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").split("");
  function update(index: number, text: string) {
    const clean = text.replace(/\D/g, "").slice(0, 6 - index);
    if (text && !clean) return;
    const next = [...digits];
    if (!clean) next[index] = " ";
    else [...clean].forEach((digit, offset) => { next[index + offset] = digit; });
    onChange(next.join("").trimEnd());
    if (clean) inputs.current[Math.min(5, index + clean.length)]?.focus();
  }
  return <div className="otp-fields" role="group" aria-label="Mã xác minh OTP gồm 6 chữ số">
    {digits.map((digit, index) => <input key={index} ref={node => { inputs.current[index] = node; }} className="auth-input otp-digit" aria-label={`Chữ số OTP ${index + 1}`} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} autoFocus={index === 0} disabled={disabled} value={digit.trim()} placeholder="–" onChange={event => update(index, event.target.value)} onFocus={event => event.target.select()} onPaste={event => { event.preventDefault(); update(index, event.clipboardData.getData("text")); }} onKeyDown={event => {
      if (event.key === "Backspace" && !digit.trim() && index > 0) { event.preventDefault(); update(index - 1, ""); inputs.current[index - 1]?.focus(); }
      if (event.key === "ArrowLeft" && index > 0) { event.preventDefault(); inputs.current[index - 1]?.focus(); }
      if (event.key === "ArrowRight" && index < 5) { event.preventDefault(); inputs.current[index + 1]?.focus(); }
    }} />)}
  </div>;
}
