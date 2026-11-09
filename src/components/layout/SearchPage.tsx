"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { searchLabels, type SearchResult } from "./GlobalSearch";
export function SearchPage({ query }: { query: string }) {
  const [term, setTerm] = useState(query),
    [type, setType] = useState("all"),
    [page, setPage] = useState(1),
    [result, setResult] = useState<SearchResult | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (query.trim().length < 2) return;
    let active = true;
    void api
      .get<SearchResult>(
        `/work/search?${new URLSearchParams({ q: query.trim(), type, page: String(page) })}`,
      )
      .then((value) => {
        if (active) {
          setResult(value);
          setError("");
        }
      })
      .catch((failure) => {
        if (active) {
          setResult(null);
          setError(
            failure instanceof Error ? failure.message : "Không tìm kiếm được.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [query, type, page]);
  const totalPages = result
    ? Math.max(
        1,
        ...result.groups.map((group) => Math.ceil(group.total / result.limit)),
      )
    : 1;
  return (
    <div className="dashboard-page handoff-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Tìm kiếm theo quyền hiện tại</span>
          <h1 className="page-title">Tìm kiếm toàn cục</h1>
          <p className="page-description">
            Công việc, nhân sự, khoa/phòng và báo cáo trong phạm vi được phép.
          </p>
        </div>
      </header>
      <form className="surface-card handoff-form" action="/workflow/search">
        <label>
          Từ khóa
          <input
            className="auth-input"
            type="search"
            name="q"
            required
            minLength={2}
            maxLength={100}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
        </label>
        <button className="primary-action" type="submit">
          Tìm kiếm
        </button>
      </form>
      <div className="workflow-tabs" role="tablist" aria-label="Loại kết quả">
        {Object.entries({ all: "Tất cả", ...searchLabels }).map(
          ([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={type === value}
              type="button"
              onClick={() => {
                setType(value);
                setPage(1);
                setResult(null);
              }}
            >
              {label}
            </button>
          ),
        )}
      </div>
      {error ? (
        <p className="workflow-alert" role="alert">
          {error}
        </p>
      ) : null}
      {!result && !error ? (
        <p className="surface-card handoff-record" role="status">
          {query.length >= 2
            ? "Đang tìm…"
            : "Nhập ít nhất 2 ký tự để tìm kiếm."}
        </p>
      ) : null}
      {result?.groups.map((group) => (
        <section className="surface-card handoff-form" key={group.type}>
          <h2>
            {searchLabels[group.type]} · {group.total} kết quả
          </h2>
          {group.items.length ? (
            <ul className="global-search-items">
              {group.items.map((item) => (
                <li key={item.id}>
                  <Link href={item.href}>
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>Không có kết quả trên trang này.</p>
          )}
        </section>
      ))}
      {result && totalPages > 1 ? (
        <nav className="workflow-pagination" aria-label="Phân trang tìm kiếm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Trước
          </button>
          <span>
            Trang {page}/{totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Sau
          </button>
        </nav>
      ) : null}
    </div>
  );
}
