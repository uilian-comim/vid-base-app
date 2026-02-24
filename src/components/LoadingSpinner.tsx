import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
// import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  className?: string;
}

export default function LoadingSpinner({ size = 'medium', message, className }: LoadingSpinnerProps) {
  const sizeClass = {
    small: 'w-5 h-5',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  }[size];

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 p-4", className)}>
      <Loader2 className={cn("animate-spin text-primary", sizeClass)} />
      {message && <p className="text-sm font-medium text-muted-foreground animate-pulse">{message}</p>}
    </div>
  );
}
