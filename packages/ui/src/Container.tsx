import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Container({ className, children, ...rest }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)} {...rest}>
      {children}
    </div>
  );
}
