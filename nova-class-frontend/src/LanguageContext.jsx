import { createContext, useContext, useState } from "react";
import { t } from "./i18n";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("nova_lang") || "en");

  function changeLang(newLang) {
    setLang(newLang);
    localStorage.setItem("nova_lang", newLang);
  }

  return (
    <LanguageContext.Provider value={{ lang, changeLang, t: (key) => t(lang, key) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
