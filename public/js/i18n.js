/**
 * 🌍 Simple i18n System for SFL Farm Helper Hub
 */

const I18n = (() => {
  const CONFIG = {
    fallbackLang: 'es',
    supportedLangs: ['es', 'en'],
    // ✅ CORRECCIÓN: ruta relativa para Cloudflare Pages
    localesPath: './locales',
    storageKey: 'sfl_helper_lang'
  };

  let currentLang = CONFIG.fallbackLang;
  let translations = {};
  let tg = window.Telegram?.WebApp;

  async function loadTranslations(lang) {
    try {
      // ✅ Usar ruta relativa con timestamp para evitar cache
      const response = await fetch(`${CONFIG.localesPath}/${lang}.json?t=${Date.now()}`);
      if (!response.ok) throw new Error(`Failed to load ${lang}.json`);
      return await response.json();
    } catch (error) {
      console.warn(`Could not load translations for '${lang}', falling back to '${CONFIG.fallbackLang}'`);
      if (lang !== CONFIG.fallbackLang) {
        return loadTranslations(CONFIG.fallbackLang);
      }
      return {};
    }
  }

  function t(key, params = {}) {
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }
    
    if (value === undefined) {
      console.warn(`Missing translation for key: '${key}' in language '${currentLang}'`);
      return key;
    }
    
    if (typeof value === 'string') {
      return value.replace(/\{\{(\w+)\}\}/g, (_, param) => params[param] ?? `{{${param}}}`);
    }
    
    return value;
  }

  async function setLanguage(lang) {
    if (!CONFIG.supportedLangs.includes(lang)) {
      console.warn(`Language '${lang}' not supported, using fallback`);
      lang = CONFIG.fallbackLang;
    }
    
    currentLang = lang;
    translations = await loadTranslations(lang);
    
    try {
      localStorage.setItem(CONFIG.storageKey, lang);
    } catch (e) {}
    
    window.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang, translations } }));
    return true;
  }

  function detectLanguage() {
    try {
      const saved = localStorage.getItem(CONFIG.storageKey);
      if (saved && CONFIG.supportedLangs.includes(saved)) return saved;
    } catch (e) {}
    
    if (tg?.initDataUnsafe?.user?.language_code) {
      const tgLang = tg.initDataUnsafe.user.language_code.toLowerCase();
      if (CONFIG.supportedLangs.includes(tgLang)) return tgLang;
      const baseLang = tgLang.split('-')[0];
      if (CONFIG.supportedLangs.includes(baseLang)) return baseLang;
    }
    
    const browserLang = (navigator.language || navigator.userLanguage).toLowerCase();
    if (CONFIG.supportedLangs.includes(browserLang)) return browserLang;
    const baseBrowserLang = browserLang.split('-')[0];
    if (CONFIG.supportedLangs.includes(baseBrowserLang)) return baseBrowserLang;
    
    return CONFIG.fallbackLang;
  }

  function getLanguage() { return currentLang; }

  function getSupportedLanguages() {
    return CONFIG.supportedLangs.map(code => ({ code, name: t(`language.${code}`) }));
  }

  async function init() {
    const detectedLang = detectLanguage();
    await setLanguage(detectedLang);
    return { getLanguage, setLanguage, t, getSupportedLanguages };
  }

  return { init, t, setLanguage, getLanguage, getSupportedLanguages };
})();

window.I18n = I18n;