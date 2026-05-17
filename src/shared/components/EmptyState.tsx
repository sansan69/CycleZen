import { type LucideIcon } from 'lucide-react';
import { Icons } from '@/components/icons';

interface EmptyStateProps {
  icon?: keyof typeof Icons;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = 'list', title, description, action }: EmptyStateProps) {
  const IconComponent = Icons[icon] || Icons.list;
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-card rounded-lg shadow">
      <IconComponent className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
      <p className="text-xl text-muted-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-2">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
