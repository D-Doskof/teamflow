import Image from 'next/image';
import { cn, getInitials } from '@/lib/utils';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

const pixelMap = { xs: 24, sm: 32, md: 40, lg: 48 };

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const sizeClass = sizeMap[size];
  const px = pixelMap[size];

  if (src) {
    return (
      <div
        className={cn('relative rounded-full overflow-hidden flex-shrink-0', sizeClass, className)}
      >
        <Image src={src} alt={name} width={px} height={px} className="object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex-shrink-0 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center',
        sizeClass,
        className,
      )}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
