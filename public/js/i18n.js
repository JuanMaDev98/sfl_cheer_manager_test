/**
 * 🌍 Simple i18n System for SFL Farm Helper Hub
 * Fácil de extender: solo añade frases en los JSON de locales/
 */

const I18n = (() => {
    // Configuración
    const CONFIG = {
      fallbackLang: 'es',
      supportedLangs: ['es', 'en'],
      localesPath: '/locales', // Ajusta si despliegas en subruta
      storageKey: 'sfl_helper_lang'
    };
  
    // Estado interno
    let currentLang = CONFIG.fallbackLang;
    let translations = {};
    let tg = window.Telegram?.WebApp;
  
    // Cargar traducciones desde JSON
    async function loadTranslations(lang) {
      try {
        const response = await fetch(`${CONFIG.localesPath}/${lang}.json`);
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
  
    // Traducir una clave con soporte para interpolación {{variable}}
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
      
      // Interpolación: {{variable}} -> params.variable
      if (typeof value === 'string') {
        return value.replace(/\{\{(\w+)\}\}/g, (_, param) => params[param] ?? `{{${param}}}`);
      }
      
      return value;
    }
  
    // Cambiar idioma y persistir preferencia
    async function setLanguage(lang) {
      if (!CONFIG.supportedLangs.includes(lang)) {
        console.warn(`Language '${lang}' not supported, using fallback`);
        lang = CONFIG.fallbackLang;
      }
      
      currentLang = lang;
      translations = await loadTranslations(lang);
      
      // Persistir en localStorage
      try {
        localStorage.setItem(CONFIG.storageKey, lang);
      } catch (e) {
        // Ignorar si localStorage no está disponible
      }
      
      // Notificar a Telegram (opcional, para analytics)
      if (tg?.sendData) {
        // tg.sendData(JSON.stringify({ event: 'language_changed', lang }));
      }
      
      // Dispatch custom event para que la UI se actualice
      window.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang, translations } }));
      
      return true;
    }
  
    // Obtener idioma guardado o detectar desde Telegram/navegador
    function detectLanguage() {
      // 1. Preferencia guardada por el usuario
      try {
        const saved = localStorage.getItem(CONFIG.storageKey);
        if (saved && CONFIG.supportedLangs.includes(saved)) {
          return saved;
        }
      } catch (e) {}
      
      // 2. Idioma de Telegram WebApp (si está disponible)
      if (tg?.initDataUnsafe?.user?.language_code) {
        const tgLang = tg.initDataUnsafe.user.language_code.toLowerCase();
        if (CONFIG.supportedLangs.includes(tgLang)) {
          return tgLang;
        }
        // Mapeo de variantes: pt-BR -> pt, en-US -> en, etc.
        const baseLang = tgLang.split('-')[0];
        if (CONFIG.supportedLangs.includes(baseLang)) {
          return baseLang;
        }
      }
      
      // 3. Idioma del navegador
      const browserLang = (navigator.language || navigator.userLanguage).toLowerCase();
      if (CONFIG.supportedLangs.includes(browserLang)) {
        return browserLang;
      }
      const baseBrowserLang = browserLang.split('-')[0];
      if (CONFIG.supportedLangs.includes(baseBrowserLang)) {
        return baseBrowserLang;
      }
      
      // 4. Fallback
      return CONFIG.fallbackLang;
    }
  
    // Obtener idioma actual
    function getLanguage() {
      return currentLang;
    }
  
    // Obtener lista de idiomas soportados con nombres traducidos
    function getSupportedLanguages() {
      return CONFIG.supportedLangs.map(code => ({
        code,
        name: t(`language.${code}`)
      }));
    }
  
    // Inicializar el sistema
    async function init() {
      const detectedLang = detectLanguage();
      await setLanguage(detectedLang);
      return { getLanguage, setLanguage, t, getSupportedLanguages };
    }
  
    // API pública
    return {
      init,
      t,
      setLanguage,
      getLanguage,
      getSupportedLanguages
    };
  })();
  
  // Exportar para uso global (si no usas módulos ES6)
  window.I18n = I18n;