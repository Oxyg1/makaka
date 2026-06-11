import { hapticImpact } from '../utils/haptics';
import './ShareButton.css';

type TgWebApp = {
  openTelegramLink?: (url: string) => void;
  shareToStory?: (url: string) => void;
};

function tg(): TgWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
}

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
  title?: string;
  className?: string;
}

export default function ShareButton({ kind, entityId, title, className }: Props) {
  const handle = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticImpact('light');
    const startParam = `${kind}_${entityId}`;
    const url = buildStartLink(startParam);
    const text =
      kind === 'cat'    ? `Оцени${title ? ` ${title}` : ' моего кота'} в Cat Rater!`
    : kind === 'post'   ? `Посмотри пост в Cat Rater`
    :                     `Загляни в Cat Rater${title ? ` — ${title}` : ''}`;

    const t = tg();
    const shareLink = buildShareUrl(url, text);
    if (t?.openTelegramLink) t.openTelegramLink(shareLink);
    else window.open(shareLink, '_blank');
  };

  return (
    <button className={`share-btn${className ? ` ${className}` : ''}`} onClick={handle} aria-label="Поделиться" title="Поделиться">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
        <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
      </svg>
    </button>
  );
}
