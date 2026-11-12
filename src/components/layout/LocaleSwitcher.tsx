"use client";

import { useLocale } from "@/i18n/locale-provider";

export function LocaleSwitcher() {
  const { locale, loading, error, setLocale, t } = useLocale();

  const changeLocale = (value: string) => {
    if (value !== "vi" && value !== "en") return;
    void setLocale(value);
  };

  return (
    <label className="locale-switcher">
      <span>{t("language.label")}</span>
      <select
        aria-label={t("language.label")}
        value={locale}
        disabled={loading}
        onChange={(event) => changeLocale(event.target.value)}
      >
        <option value="vi">{t("language.vietnamese")}</option>
        <option value="en">{t("language.english")}</option>
      </select>
      {loading ? <span role="status">{t("language.loading")}</span> : null}
      {error ? (
        <span className="locale-switcher-error" role="alert">
          {error}
          <button type="button" onClick={() => void setLocale("en")}>
            {locale === "en" ? "Retry" : "Thử lại"}
          </button>
        </span>
      ) : null}
    </label>
  );
}
