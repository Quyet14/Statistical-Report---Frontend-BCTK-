"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";

type PasswordFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  wrapperClassName?: string;
};

export function PasswordField({ wrapperClassName = "", ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = props.id ?? generatedId;

  return (
    <span className={`password-field ${wrapperClassName}`.trim()}>
      <input {...props} id={inputId} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
        title={visible ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
        aria-controls={inputId}
        aria-pressed={visible}
        disabled={props.disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeInvisibleOutlined aria-hidden="true" /> : <EyeOutlined aria-hidden="true" />}
      </button>
    </span>
  );
}
