import Image from 'next/image';

interface AvatarProps {
  image: string | null;
  name: string;
  size?: 'small' | 'medium' | 'large';
}

export function Avatar({
  image,
  name,
  size = 'medium',
}: AvatarProps) {
  const dimension = size === 'large' ? 80 : size === 'small' ? 36 : 48;
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      className={'avatar avatar-' + size}
      aria-hidden="true"
    >
      {image ? (
        <Image
          alt=""
          src={image}
          width={dimension}
          height={dimension}
          sizes={dimension + 'px'}
        />
      ) : (
        <span>{initials || '?'}</span>
      )}
    </span>
  );
}
