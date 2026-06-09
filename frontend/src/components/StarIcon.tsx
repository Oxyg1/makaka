/* Custom Telegram Stars icon — PNG asset.
 * Drop your PNG at `frontend/public/star.png` (and optionally star@2x.png for retina). */
export default function StarIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/star.png"
      srcSet="/star.png 1x, /star@2x.png 2x"
      width={size}
      height={size}
      alt=""
      aria-hidden
      className={className}
      style={{ display: 'block', width: size, height: size, flexShrink: 0 }}
      draggable={false}
    />
  );
}
