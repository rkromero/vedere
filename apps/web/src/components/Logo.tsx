import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  variant?: 'negro' | 'blanco';
  height?: number;
  className?: string;
}

/** Logo de marca desde /public/brand (SVG). */
export function Logo({ variant = 'negro', height = 28, className }: LogoProps) {
  const src = variant === 'blanco' ? '/brand/logo-blanco.svg' : '/brand/logo.svg';
  return (
    <Link href="/" aria-label="Vedere — inicio" className={className}>
      <Image src={src} alt="Vedere" width={height * 4} height={height} priority />
    </Link>
  );
}
