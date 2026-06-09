/* iOS-26 style star (Telegram Stars). Swap this file later with your custom SVG. */
export default function StarIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="star-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE486" />
          <stop offset="60%" stopColor="#FFB800" />
          <stop offset="100%" stopColor="#F08000" />
        </linearGradient>
      </defs>
      <path
        d="M12.7 1.84a.8.8 0 0 0-1.4 0L8.66 7.05l-5.7.83a.8.8 0 0 0-.44 1.36l4.13 4.02-.98 5.68a.8.8 0 0 0 1.16.84L12 17.1l5.17 2.68a.8.8 0 0 0 1.16-.84l-.98-5.68 4.13-4.02a.8.8 0 0 0-.44-1.36l-5.7-.83-2.64-5.21z"
        fill="url(#star-grad)"
        stroke="rgba(255,200,80,0.7)"
        strokeWidth="0.4"
      />
    </svg>
  );
}
