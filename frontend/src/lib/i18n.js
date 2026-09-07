import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from '../locales/en.json';

const FALLBACK_LNG = 'en';

/**
 * Locales that are fetched on demand instead of riding along in the entry chunk.
 *
 * `en` stays statically bundled because it is the fallback language: it must be in
 * the store before the first render. Every other language becomes its own lazy chunk,
 * so a user only ever downloads the one they actually read.
 */
const LAZY_LOCALES = {
  ru: () => import('../locales/ru.json'),
};

/**
 * Minimal i18next backend. Going through the backend contract (rather than calling
 * addResourceBundle ourselves) means i18next resolves `changeLanguage` only after the
 * bundle has landed — so switching languages never flashes raw translation keys.
 */
const lazyLocaleBackend = {
  type: 'backend',
  init() {},
  read(lng, ns, callback) {
    const load = LAZY_LOCALES[lng];
    if (!load || ns !== 'translation') {
      // Unknown language: hand back an empty bundle and let fallbackLng take over.
      callback(null, {});
      return;
    }
    load()
      .then((mod) => callback(null, mod.default))
      .catch((err) => callback(err, false));
  },
};

export const i18nReady = i18n
  .use(lazyLocaleBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslation,
      },
    },
    // Tell i18next the store is pre-seeded so it does not re-request bundled locales.
    partialBundledLanguages: true,
    // 'ru-RU' resolves straight to 'ru'; we ship no region-specific bundles.
    load: 'languageOnly',
    fallbackLng: FALLBACK_LNG,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
