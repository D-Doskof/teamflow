import type { Locale } from '@/store/locale.store';

// Backend errors always carry an English `message` as the built-in fallback.
// This table only needs entries for locales that should override it — 'en' is
// intentionally absent so English requests always fall through to that message.
export const errorMessages: Partial<Record<Locale, Record<string, string>>> = {
  ru: {
    INVALID_CREDENTIALS: 'Неверный email или пароль',
    EMAIL_ALREADY_REGISTERED: 'Этот email уже зарегистрирован',
    INVALID_VERIFICATION_CODE: 'Неверный или истёкший код',
    EMAIL_ALREADY_VERIFIED: 'Email уже подтверждён',
    INVALID_RESET_LINK: 'Ссылка недействительна или истекла',
    INVALID_REFRESH_TOKEN: 'Сессия истекла, войдите заново',
    INCORRECT_CURRENT_PASSWORD: 'Текущий пароль указан неверно',
    USER_NOT_FOUND: 'Пользователь не найден',
    INVALID_TWO_FACTOR_TOKEN: 'Сессия входа истекла, попробуйте войти заново',
    VERIFICATION_CODE_REQUIRED: 'Введите код подтверждения из письма',
    TWO_FACTOR_NOT_ENABLED: 'Двухфакторная аутентификация уже выключена',
  },
  pl: {
    INVALID_CREDENTIALS: 'Nieprawidłowy email lub hasło',
    EMAIL_ALREADY_REGISTERED: 'Ten email jest już zarejestrowany',
    INVALID_VERIFICATION_CODE: 'Nieprawidłowy lub wygasły kod',
    EMAIL_ALREADY_VERIFIED: 'Email został już potwierdzony',
    INVALID_RESET_LINK: 'Link jest nieprawidłowy lub wygasł',
    INVALID_REFRESH_TOKEN: 'Sesja wygasła, zaloguj się ponownie',
    INCORRECT_CURRENT_PASSWORD: 'Podano nieprawidłowe obecne hasło',
    USER_NOT_FOUND: 'Nie znaleziono użytkownika',
    INVALID_TWO_FACTOR_TOKEN: 'Sesja logowania wygasła, spróbuj ponownie',
    VERIFICATION_CODE_REQUIRED: 'Wprowadź kod weryfikacyjny z wiadomości e-mail',
    TWO_FACTOR_NOT_ENABLED: 'Uwierzytelnianie dwuskładnikowe jest już wyłączone',
  },
};
