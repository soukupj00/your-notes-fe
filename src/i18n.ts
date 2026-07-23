import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

i18n
  .use(HttpBackend) // loads translations from /locales/{{lng}}/translation.json
  .use(LanguageDetector) // detects user language (browser/localStorage)
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'cs'], // must match the folders under public/locales
    debug: import.meta.env.DEV, // only debug in dev mode
    interpolation: {
      escapeValue: false, // react already escapes
    },
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
  });

export default i18n;
