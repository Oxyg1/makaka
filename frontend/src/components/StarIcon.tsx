/* Custom Telegram Stars icon — PNG asset.
 * Drop your PNG at `frontend/public/star.png`. */
export default function StarIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/star.png"
      width={size}
      height={size}
      alt=""
      aria-hidden
      className={className}
      style={{ display: 'block', width: size, height: size, flexShrink: 0, objectFit: 'contain' }}
      draggable={false}
    />
  );
}
