/**
 * Lightweight i18n system for FAIRWallet.
 * Supports English and Spanish with device-locale detection.
 * No heavy library dependencies - simple key-value translations.
 */

import { getLocales } from "expo-localization";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Language = "en" | "es";

// ---------------------------------------------------------------------------
// Translation strings
// ---------------------------------------------------------------------------

const translations: Record<Language, Record<string, string>> = {
  en: {
    "wallet.title": "Wallet",
    "wallet.balance": "Total Balance",
    "wallet.send": "Send",
    "wallet.receive": "Receive",
    "wallet.settings": "Settings",
    "wallet.contacts": "Contacts",
    "send.title": "Send FAIR",
    "send.to_address": "To Address",
    "send.amount": "Amount",
    "send.fee": "Fee",
    "send.total": "Total",
    "send.confirm": "Confirm Send",
    "send.success": "Transaction Sent",
    "receive.title": "Receive FAIR",
    "receive.copy": "Copy Address",
    "receive.share": "Share",
    "receive.new_address": "New Address",
    "settings.wallets": "Manage Wallets",
    "settings.contacts": "Contacts",
    "settings.security": "Security",
    "settings.network": "Network",
    "settings.backup": "Backup",
    "settings.advanced": "Advanced",
    "settings.about": "About",
    "settings.wipe": "Wipe Wallet",
    "settings.change_pin": "Change PIN",
    "settings.biometrics": "Biometric Unlock",
    "settings.show_phrase": "Show Recovery Phrase",
    "settings.auto_lock": "Auto-Lock",
    "settings.currency": "Display Currency",
    "contacts.title": "Contacts",
    "contacts.add": "Add Contact",
    "contacts.edit": "Edit Contact",
    "contacts.empty": "No contacts yet",
    "contacts.search": "Search contacts...",
    "onboarding.welcome": "Welcome to FAIRWallet",
    "onboarding.subtitle": "Your FairCoin wallet",
    "onboarding.create": "Create New Wallet",
    "onboarding.restore": "Restore Wallet",
    "onboarding.pin_setup": "Set a PIN",
    "onboarding.pin_confirm": "Confirm PIN",
    "lock.title": "Enter PIN",
    "lock.biometric": "Use biometrics to unlock",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.confirm": "Confirm",
    "common.error": "Error",
    "common.loading": "Loading...",
    "common.paste": "Paste",
    "common.copy": "Copy",
  },
  es: {
    "wallet.title": "Billetera",
    "wallet.balance": "Saldo Total",
    "wallet.send": "Enviar",
    "wallet.receive": "Recibir",
    "wallet.settings": "Ajustes",
    "wallet.contacts": "Contactos",
    "send.title": "Enviar FAIR",
    "send.to_address": "Direcci\u00f3n destino",
    "send.amount": "Cantidad",
    "send.fee": "Comisi\u00f3n",
    "send.total": "Total",
    "send.confirm": "Confirmar Env\u00edo",
    "send.success": "Transacci\u00f3n Enviada",
    "receive.title": "Recibir FAIR",
    "receive.copy": "Copiar Direcci\u00f3n",
    "receive.share": "Compartir",
    "receive.new_address": "Nueva Direcci\u00f3n",
    "settings.wallets": "Gestionar Billeteras",
    "settings.contacts": "Contactos",
    "settings.security": "Seguridad",
    "settings.network": "Red",
    "settings.backup": "Respaldo",
    "settings.advanced": "Avanzado",
    "settings.about": "Acerca de",
    "settings.wipe": "Borrar Billetera",
    "settings.change_pin": "Cambiar PIN",
    "settings.biometrics": "Desbloqueo Biom\u00e9trico",
    "settings.show_phrase": "Mostrar Frase de Recuperaci\u00f3n",
    "settings.auto_lock": "Bloqueo Autom\u00e1tico",
    "settings.currency": "Moneda de Visualizaci\u00f3n",
    "contacts.title": "Contactos",
    "contacts.add": "Agregar Contacto",
    "contacts.edit": "Editar Contacto",
    "contacts.empty": "Sin contactos a\u00fan",
    "contacts.search": "Buscar contactos...",
    "onboarding.welcome": "Bienvenido a FAIRWallet",
    "onboarding.subtitle": "Tu billetera FairCoin",
    "onboarding.create": "Crear Nueva Billetera",
    "onboarding.restore": "Restaurar Billetera",
    "onboarding.pin_setup": "Establecer un PIN",
    "onboarding.pin_confirm": "Confirmar PIN",
    "lock.title": "Ingresa tu PIN",
    "lock.biometric": "Usa biometr\u00eda para desbloquear",
    "common.cancel": "Cancelar",
    "common.save": "Guardar",
    "common.delete": "Eliminar",
    "common.confirm": "Confirmar",
    "common.error": "Error",
    "common.loading": "Cargando...",
    "common.paste": "Pegar",
    "common.copy": "Copiar",
  },
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentLanguage: Language = "en";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the device language and set the current language.
 * Falls back to English for unsupported locales.
 */
export function initLanguage(): void {
  const locales = getLocales();
  const deviceLang = locales[0]?.languageCode ?? "en";
  currentLanguage = deviceLang === "es" ? "es" : "en";
}

/**
 * Translate a key to the current language.
 * Falls back to English, then returns the key itself if not found.
 */
export function t(key: string): string {
  return translations[currentLanguage][key] ?? translations.en[key] ?? key;
}

/**
 * Set the current language explicitly.
 */
export function setLanguage(lang: Language): void {
  currentLanguage = lang;
}

/**
 * Get the current language.
 */
export function getLanguage(): Language {
  return currentLanguage;
}
