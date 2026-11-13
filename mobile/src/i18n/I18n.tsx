import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getLocales } from "expo-localization";
import { prefsStore } from "../data/sqlite";
import { bigTitle, resolveLang, translate, type Key, type Lang, type TitleKey } from "./strings";

type I18n = {
  lang: Lang;
  titlesInEnglish: boolean;
  t: (key: Key, vars?: Record<string, string | number>) => string;
  title: (key: TitleKey) => string;
  setLang: (lang: Lang) => void;
  setTitlesInEnglish: (on: boolean) => void;
};

const deviceTags = () => getLocales().map((l) => l.languageTag);

// 화면 밖의 짧은 함수(링크 열기 실패 알림 같은 것)가 쓰는 지금 언어. 화면은 useI18n을 쓴다.
let currentLang: Lang = resolveLang(null, deviceTags());
export function translateNow(key: Key, vars?: Record<string, string | number>) {
  return translate(currentLang, key, vars);
}

const I18nContext = createContext<I18n | null>(null);

/** 처음엔 기기 언어를 따르고, 설정에서 고르면 그 언어를 저장해 쓴다. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => resolveLang(null, deviceTags()));
  const [titlesInEnglish, setTitles] = useState(true);
  useEffect(() => {
    prefsStore.load().then(
      (saved) => {
        setLangState(resolveLang(saved.language, deviceTags()));
        setTitles(saved.titlesInEnglish);
      },
      () => undefined,
    );
  }, []);
  currentLang = lang;
  const value = useMemo<I18n>(
    () => ({
      lang,
      titlesInEnglish,
      t: (key, vars) => translate(lang, key, vars),
      title: (key) => bigTitle(lang, titlesInEnglish, key),
      setLang: (next) => {
        setLangState(next);
        void prefsStore.save("language", next).catch(() => undefined);
      },
      setTitlesInEnglish: (on) => {
        setTitles(on);
        void prefsStore.save("titles_en", on ? "1" : "0").catch(() => undefined);
      },
    }),
    [lang, titlesInEnglish],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
