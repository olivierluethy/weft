import { initials, hashHue } from '@/lib/utils';

export function Avatar({
  name,
  src,
  size = 28,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const hue = hashHue(name);
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-display font-medium text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `hsl(${hue} 42% 45%)`,
      }}
    >
      {initials(name) || '?'}
    </span>
  );
}
