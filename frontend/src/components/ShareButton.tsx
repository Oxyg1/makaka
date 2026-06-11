import { hapticImpact } from '../utils/haptics';
import './ShareButton.css';

type TgWebApp = {
  openTelegramLink?: (url: string) => void;
  shareToStory?: (url: string) => void;
};

function tg(): TgWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
}

/** Bot username for deep-link sharing. Pulled from Vite env so it can be
 *  swapped without touching code. Fallback to a placeholder so the link is
 *  still well-formed during local dev. */
const BOT_USERNAME = (import.meta.env.VITE_BOT_USERNAME as string | undefined) ?? 'cat_rater_bot';
const APP_NAME = (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'app';

function buildStartLink(startParam: string): string {
  return `https://t.me/${BOT_USERNAME}/${APP_NAME}?startapp=${encodeURIComponent(startParam)}`;
}

function buildShareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

interface Props {
  kind: 'cat' | 'post' | 'profile';
  entityId: number;
  /** Display name used in the share message. */
  title?: string;
  className?: string;
}

export default function ShareButton({ kind, entityId, title, className }: Props) {
  const handle = () => {
    hapticImpact('light');
    const startParam = `${kind}_${entityId}`;
    const url = buildStartLink(startParam);
    const text =
      kind === 'cat'    ? `Оцени${title ? ` ${title}` : ' моего кота'} в Cat Rater!`
    : kind === 'post'   ? `Посмотри пост в Cat Rater`
    :                     `Загляни в Cat Rater${title ? ` — ${title}` : ''}`;

    const t = tg();
    const shareLink = buildShareUrl(url, text);
    if (t?.openTelegramLink) {
      t.openTelegramLink(shareLink);
    } else {
      window.open(shareLink, '_blank');
    }
  };

  return (
    <button className={`share-btn${className ? ` ${className}` : ''}`} onClick={handle} aria-label="Поделиться">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      <span>Поделиться</span>
    </button>
  );
}
