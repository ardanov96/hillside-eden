import type { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TremorKpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  deltaText?: string;
  deltaType?: "positive" | "negative" | "neutral";
  badgeText?: string;
  badgeVariant?: "success" | "warning" | "default" | "secondary";
  icon: ReactNode;
  iconBgColor?: string;
  progressPct?: number;
}

export function TremorKpiCard({
  title,
  value,
  subtitle,
  deltaText,
  deltaType = "positive",
  badgeText,
  badgeVariant = "default",
  icon,
  iconBgColor = "bg-primary/10 text-primary",
  progressPct,
}: TremorKpiCardProps) {
  const isPositive = deltaType === "positive";

  return (
    <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-md border-border/70 bg-card">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {title}
            </span>
            <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {value}
            </div>
          </div>
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-2xs",
              iconBgColor,
            )}
          >
            {icon}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-xs">
          <div className="flex items-center gap-1.5">
            {deltaText ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
                  isPositive
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
                )}
              >
                {isPositive ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                <span>{deltaText}</span>
              </span>
            ) : null}
            <span className="text-[11px] text-muted-foreground">{subtitle}</span>
          </div>

          {badgeText ? (
            <Badge variant={badgeVariant} className="text-[10px] px-2 py-0.5 font-semibold">
              {badgeText}
            </Badge>
          ) : null}
        </div>

        {typeof progressPct === "number" ? (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
