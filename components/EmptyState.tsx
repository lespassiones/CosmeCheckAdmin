import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("neo-card flex flex-col items-center justify-center gap-3 py-10 px-6 text-center", className)}>
      {Icon && (
        <span
          aria-hidden
          className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 text-rose-500 ring-1 ring-rose-100"
        >
          <Icon className="h-5 w-5" />
        </span>
      )}
      <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
      {description && (
        <p className="max-w-md text-[13px] text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
