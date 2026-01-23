import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const baseStyles = 'font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800',
    secondary: 'bg-slate-200 text-slate-900 hover:bg-slate-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
    outline: 'bg-white border-2 border-slate-900 text-slate-900 hover:bg-slate-50'
  };
  
  const sizes = {
    sm: 'px-4 py-2 text-xs rounded-lg',
    md: 'px-6 py-3 text-xs rounded-xl',
    lg: 'px-8 py-4 text-sm rounded-xl'
  };
  
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
