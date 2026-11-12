"use client";

import { useEffect } from "react";
import { UI_LITERAL_KEYS } from "./ui-literal-keys";
import type { UiLocale } from "./locale-provider";

type Translation = { source: string; translated: string };

const textTranslations = new WeakMap<Text, Translation>();
const attributeTranslations = new WeakMap<Element, Map<string, Translation>>();
const translatableAttributes = ["aria-label", "alt", "placeholder", "title"];

function normalized(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function shouldSkip(element: Element | null) {
  return !!element?.closest(
    '[data-i18n-skip],input,textarea,script,style,[contenteditable="true"]',
  );
}

function translationsFor(
  dictionary: Record<string, string>,
  sourceStrings: Record<string, string>,
  fallback: Record<string, string>,
) {
  const translations = new Map<string, string>();
  for (const [key, source] of Object.entries(sourceStrings)) {
    const translated = dictionary[key] ?? fallback[key];
    if (translated && translated !== source)
      translations.set(normalized(source), translated);
  }
  for (const [source, key] of Object.entries(UI_LITERAL_KEYS)) {
    const translated = dictionary[key];
    if (translated && translated !== source)
      translations.set(normalized(source), translated);
  }
  return translations;
}

function syncText(
  node: Text,
  locale: UiLocale,
  translations: Map<string, string>,
) {
  const current = node.data;
  const previous = textTranslations.get(node);
  const source =
    previous && current === previous.translated ? previous.source : current;
  if (locale === "vi") {
    if (previous && current !== source) node.data = source;
    textTranslations.delete(node);
    return;
  }
  const translated = translations.get(normalized(source));
  if (!translated || translated === normalized(source)) {
    textTranslations.delete(node);
    return;
  }
  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  const next = `${leading}${translated}${trailing}`;
  textTranslations.set(node, { source, translated: next });
  if (current !== next) node.data = next;
}

function syncAttributes(
  element: Element,
  locale: UiLocale,
  translations: Map<string, string>,
) {
  if (shouldSkip(element)) return;
  let records = attributeTranslations.get(element);
  for (const name of translatableAttributes) {
    const current = element.getAttribute(name);
    if (current === null) continue;
    const previous = records?.get(name);
    const source =
      previous && current === previous.translated
        ? previous.source
        : current;
    if (locale === "vi") {
      if (previous && current !== source) element.setAttribute(name, source);
      records?.delete(name);
      continue;
    }
    const translated = translations.get(normalized(source));
    if (!translated || translated === normalized(source)) {
      records?.delete(name);
      continue;
    }
    records ??= new Map();
    const leading = source.match(/^\s*/)?.[0] ?? "";
    const trailing = source.match(/\s*$/)?.[0] ?? "";
    const next = `${leading}${translated}${trailing}`;
    records.set(name, { source, translated: next });
    attributeTranslations.set(element, records);
    if (current !== next) element.setAttribute(name, next);
  }
}

function syncNode(
  node: Node,
  locale: UiLocale,
  translations: Map<string, string>,
) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node as Text;
    if (!shouldSkip(text.parentElement)) syncText(text, locale, translations);
    return;
  }
  if (!(node instanceof Element) || shouldSkip(node)) return;
  syncAttributes(node, locale, translations);
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let child: Node | null;
  while ((child = walker.nextNode())) {
    const text = child as Text;
    if (!shouldSkip(text.parentElement)) syncText(text, locale, translations);
  }
  node.querySelectorAll("*").forEach((element) => {
    if (!shouldSkip(element)) syncAttributes(element, locale, translations);
  });
}

export function LocalizedDom({
  locale,
  dictionary,
  sourceStrings,
  fallback,
}: {
  locale: UiLocale;
  dictionary: Record<string, string>;
  sourceStrings: Record<string, string>;
  fallback: Record<string, string>;
}) {
  useEffect(() => {
    const translations = translationsFor(dictionary, sourceStrings, fallback);
    if (document.body) syncNode(document.body, locale, translations);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData" && record.target.nodeType === Node.TEXT_NODE) {
          syncNode(record.target, locale, translations);
        } else if (record.type === "attributes" && record.target instanceof Element) {
          syncAttributes(record.target, locale, translations);
        } else {
          record.addedNodes.forEach((node) =>
            syncNode(node, locale, translations),
          );
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: translatableAttributes,
    });
    return () => observer.disconnect();
  }, [dictionary, fallback, locale, sourceStrings]);

  return null;
}
