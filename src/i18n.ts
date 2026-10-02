import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'cs'], // folders under public/locales
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // react already escapes
    },
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
  })
  // Translations are fetched over HTTP, so init can reject (offline on a cold
  // load, a bad deploy). i18next still renders keys via the fallback, so this
  // must not be fatal - but it must not be a silent unhandled rejection either.
  .catch((error) => {
    console.error('i18n: failed to initialise', error);
  });

export default i18n;
