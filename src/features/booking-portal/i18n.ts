import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import fr from './locales/fr.json'

function initialLanguage(): 'en' | 'fr' {
  try {
    const saved = localStorage.getItem('ayana-booking-language')
    if (saved === 'en' || saved === 'fr') return saved
  } catch {
    // Fall back to the browser preference when storage is unavailable.
  }

  const preferred = navigator.languages?.[0] ?? navigator.language ?? 'fr'
  return /^fr(?:-|$)/i.test(preferred) ? 'fr' : 'en'
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { en: { bookingPortal: en }, fr: { bookingPortal: fr } },
    lng: initialLanguage(),
    fallbackLng: 'fr',
    supportedLngs: ['en', 'fr'],
    defaultNS: 'bookingPortal',
    ns: ['bookingPortal'],
    keySeparator: false,
    interpolation: { escapeValue: false },
    returnNull: false,
  })
}

export default i18n
