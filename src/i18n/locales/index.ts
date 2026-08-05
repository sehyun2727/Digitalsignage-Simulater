import type { Locale, Messages } from '../../types/i18n';
import { en } from './en';
import { ja } from './ja';
import { ko } from './ko';

export const MESSAGES: Record<Locale, Messages> = { ja, ko, en };
