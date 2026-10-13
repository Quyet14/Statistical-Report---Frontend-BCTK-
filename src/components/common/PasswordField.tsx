"use client";

import { useState, type InputHTMLAttributes } from "react";

type PasswordFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  wrapperClassName?: string;
};

export function PasswordField({ wrapperClassName = "", ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className={`password-field ${wrapperClassName}`.trim()}>
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
        title={visible ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? "◉" : "◌"}
      </button>
    </span>
  );
}
