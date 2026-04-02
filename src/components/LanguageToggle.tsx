import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LanguageToggleProps {
  variant?: 'sidebar' | 'default';
}

export const LanguageToggle = ({ variant = 'sidebar' }: LanguageToggleProps) => {
  const { language, setLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(language === 'uk' ? 'en' : 'uk')}
      className={cn(
        'gap-2',
        variant === 'sidebar'
          ? 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent'
          : 'text-foreground/80 hover:text-foreground hover:bg-secondary'
      )}
    >
      <Globe className="h-4 w-4" />
      <span className="uppercase font-medium">{language === 'uk' ? 'EN' : 'UA'}</span>
    </Button>
  );
};
