import React from 'react';
import { cn } from '../../utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outlined' | 'elevated';
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const variantClasses = {
  default: 'bg-white border border-gray-200',
  outlined: 'bg-white border-2 border-gray-300',
  elevated: 'bg-white shadow-lg border border-gray-100',
};

export const Card: React.FC<CardProps> = ({ 
  children, 
  className,
  padding = 'md',
  variant = 'default'
}) => {
  return (
    <div className={cn(
      'rounded-lg',
      variantClasses[variant],
      paddingClasses[padding],
      className
    )}>
      {children}
    </div>
  );
};

export default Card;