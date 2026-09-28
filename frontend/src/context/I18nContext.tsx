import { createContext, createSignal, useContext, type JSX, type Setter } from "solid-js";
import en from "~/i18n/en.json";
import { translate, type Dictionary, type TranslationKey, type TranslationParams } from "~/i18n/translate";

interface I18nContextValue {
  // Reads the dictionary signal, so calls made in JSX or effects re-run when it changes.
  t: (key: TranslationKey, params?: TranslationParams) => string;
  setDictionary: Setter<Dictionary>;
}

const I18nContext = createContext<I18nContextValue>();

interface I18nProviderProps {
  dictionary?: Dictionary;
  children: JSX.Element;
}

export function I18nProvider(props: I18nProviderProps) {
  const [dictionary, setDictionary] = createSignal<Dictionary>(props.dictionary ?? en);

  const value: I18nContextValue = {
    t: (key, params) => translate(dictionary(), key, params),
    setDictionary,
  };

  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
