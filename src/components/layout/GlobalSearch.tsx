"use client";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";
export type SearchItem = {
  id: number;
  title: string;
  subtitle: string;
  href: string;
};
export type SearchResult = {
  query: string;
  page: number;
  limit: number;
  groups: { type: string; total: number; items: SearchItem[] }[];
};
export const searchLabels: Record<string, string> = {
  tasks: "Công việc",
  people: "Nhân sự",
  departments: "Khoa/phòng",
  reports: "Báo cáo",
};
export function GlobalSearch() {
  const router = useRouter(),
    id = useId();
  const [query, setQuery] = useState(""),
    [result, setResult] = useState<SearchResult | null>(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(-1);
  const term = query.trim();
  const matches =
    result?.query === term
      ? result.groups
          .flatMap((group) =>
            group.items.map((item) => ({ ...item, type: group.type })),
          )
          .slice(0, 8)
      : [];
  useEffect(() => {
    if (term.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      setError("");
      void api
        .get<SearchResult>(`/work/search?q=${encodeURIComponent(term)}`)
        .then((value) => {
          if (active) setResult(value);
        })
        .catch((failure) => {
          if (active) {
            setResult(null);
            setError(
              failure instanceof Error
                ? failure.message
                : "Không tìm kiếm được dữ liệu.",
            );
          }
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term]);
  function navigate(href: string) {
    setQuery("");
    setSelected(-1);
    router.push(href);
  }
  return (
    <div className="search-box">
      <SearchOutlined className="search-icon" aria-hidden="true" />
      <input
        type="search"
        maxLength={100}
        value={query}
        placeholder="Tìm việc, nhân sự, khoa/phòng…"
        aria-label="Tìm công việc, nhân sự, khoa phòng"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={term.length >= 2}
        aria-controls={id}
        aria-activedescendant={selected >= 0 ? `${id}-${selected}` : undefined}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelected(-1);
          setError("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setQuery("");
            setSelected(-1);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelected((index) => Math.min(matches.length - 1, index + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelected((index) => Math.max(-1, index - 1));
          } else if (event.key === "Enter" && term.length >= 2) {
            event.preventDefault();
            navigate(
              matches[selected]?.href ??
                `/workflow/search?q=${encodeURIComponent(term)}`,
            );
          }
        }}
      />
      {term.length >= 2 ? (
        <div className="search-results">
          <div id={id} role="listbox" aria-label="Kết quả tìm kiếm">
            {matches.map((item, index) => (
              <button
                key={item.type + item.id}
                id={`${id}-${index}`}
                type="button"
                role="option"
                aria-selected={selected === index}
                className="search-result"
                onClick={() => navigate(item.href)}
              >
                <strong>{item.title}</strong>
                <span>
                  {searchLabels[item.type]} · {item.subtitle}
                </span>
              </button>
            ))}
            {!matches.length ? (
              <p className="search-empty" role="status">
                {error ||
                  (result?.query === term
                    ? "Không có kết quả trong phạm vi của bạn."
                    : "Đang tìm…")}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="search-result"
            onClick={() =>
              navigate(`/workflow/search?q=${encodeURIComponent(term)}`)
            }
          >
            Xem tất cả kết quả →
          </button>
        </div>
      ) : null}
    </div>
  );
}
