import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, User, Clock, StickyNote, Trash2, Scissors, Armchair, Sparkles, Hourglass, CheckCircle2, Gauge } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";
import { computeEfficiency, efficiencyClasses } from "@/lib/efficiency";
import QuickReschedulePopover from "./QuickReschedulePopover";
import type { Job, JobStatus } from "@/types/database";

interface Props {
  job: Job & { customer?: any; service_catalog?: { name: string; duration_minutes: number | null } | null };
  status: JobStatus;
  stylistName: string | null;
  chairName?: string | null;
  onOpenDetail: () => void;
  onAssign: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (status: JobStatus) => void;
  onRescheduled?: () => void;
  statuses: { status: JobStatus; label: string }[];
  accentClass: string; // e.g. "bg-primary"
}

export default function AppointmentCard({
  job, status, stylistName, chairName, onOpenDetail, onAssign, onEdit, onDelete, onMove, onRescheduled, statuses, accentClass,
}: Props) {
  // Live timer for in_progress
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== "in_progress") return;
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, [status]);

  const initials = ((job.customer as any)?.name ?? "??")
    .split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();

  const dur = (job as any).service_catalog?.duration_minutes ?? 45;
  const startedAt = (job as any).started_at ? new Date((job as any).started_at) : null;
  const elapsed = startedAt ? differenceInMinutes(new Date(), startedAt) : 0;
  const ringPct = startedAt && status === "in_progress"
    ? Math.min(100, (elapsed / dur) * 100)
    : 0;
  const overrun = elapsed > dur;

  // Service price chip
  const price = (job as any).pay_amount;

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", job.id)}
      onClick={onOpenDetail}
      className={cn(
        "group relative cursor-grab active:cursor-grabbing rounded-xl bg-card border border-border/60",
        "hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
      )}
    >
      <span className={cn("absolute left-0 top-0 bottom-0 w-1", accentClass)} />

      <div className="pl-4 pr-3 py-3 space-y-2.5">
        {/* Header row: avatar + name + menu */}
        <div className="flex items-start gap-2.5">
          <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center text-xs font-bold shadow-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm font-semibold truncate leading-tight">
              {(job.customer as any)?.name ?? "Walk-in"}
            </p>
            <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
              <QuickReschedulePopover
                jobId={job.id}
                scheduledAt={job.scheduled_at}
                onSaved={onRescheduled}
              />
              <span className="text-[11px] text-muted-foreground opacity-60 ml-1">· {dur}m</span>
            </div>
          </div>

          {/* Live ring for in-chair */}
          {status === "in_progress" && (
            <div className="relative h-9 w-9 shrink-0">
              <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-muted" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  className={overrun ? "stroke-warning" : "stroke-accent"}
                  strokeWidth="3"
                  strokeDasharray={`${ringPct} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className={cn(
                "absolute inset-0 flex items-center justify-center text-[9px] font-bold",
                overrun ? "text-warning" : "text-foreground"
              )}>
                {elapsed}m
              </span>
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1 opacity-60 group-hover:opacity-100">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {statuses.filter(s => s.status !== status).map(s => (
                <DropdownMenuItem key={s.status} onClick={() => onMove(s.status)}>
                  → Move to {s.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEdit}>
                <StickyNote className="mr-2 h-3.5 w-3.5" /> Edit appointment
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAssign}>
                <User className="mr-2 h-3.5 w-3.5" /> Assign stylist
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Service chip */}
        {((job as any).service_catalog?.name || job.notes) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Scissors className="h-3 w-3 text-primary/70" />
            <span className="truncate">
              {(job as any).service_catalog?.name || job.notes}
            </span>
          </div>
        )}

        {/* Progress quick-actions: in-chair / halfway / done */}
        {(status === "confirmed" || status === "in_progress") && (
          <div className="flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
            {([
              { key: "in_chair", label: "In chair", Icon: Sparkles },
              { key: "halfway", label: "Halfway", Icon: Hourglass },
              { key: "done", label: "Done", Icon: CheckCircle2 },
            ] as const).map(({ key, label, Icon }) => {
              const active = (job as any).progress === key;
              return (
                <button
                  key={key}
                  onClick={async () => {
                    const patch: any = { progress: key };
                    if (key === "in_chair" && status !== "in_progress") {
                      patch.status = "in_progress";
                      patch.started_at = new Date().toISOString();
                    }
                    if (key === "done") {
                      patch.status = "completed";
                      patch.completed_at = new Date().toISOString();
                    }
                    const { error } = await api.from("jobs").update(patch).eq("id", job.id);
                    if (error) toast.error(error.message);
                    else toast.success(`Marked ${label.toLowerCase()}`);
                    onRescheduled?.();
                  }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 text-[10px] py-1 rounded border transition",
                    active
                      ? "bg-primary/10 border-primary text-primary"
                      : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  <Icon className="h-2.5 w-2.5" /> {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Efficiency badge — shown once started or completed */}
        {((job as any).started_at || (job as any).completed_at) && (() => {
          const eff = computeEfficiency(job as any);
          if (eff.status === "unknown") return null;
          return (
            <div className={cn("flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border w-fit", efficiencyClasses(eff.status))}>
              <Gauge className="h-2.5 w-2.5" />
              <span>{eff.label}</span>
              <span className="opacity-60">· planned {eff.planned}m</span>
            </div>
          );
        })()}

        {/* Stylist + price footer */}
        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/40">
          <button
            onClick={(e) => { e.stopPropagation(); onAssign(); }}
            className={cn(
              "flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border transition",
              stylistName
                ? "bg-accent/10 border-accent/30 text-foreground hover:bg-accent/20"
                : chairName
                  ? "bg-primary/10 border-primary/30 text-foreground hover:bg-primary/20"
                  : "bg-warning/10 border-warning/40 text-foreground hover:bg-warning/20"
            )}
          >
            {stylistName ? <User className="h-3 w-3" /> : <Armchair className="h-3 w-3" />}
            <span className="truncate max-w-[110px]">
              {stylistName || (chairName ? `Chair: ${chairName}` : "Unassigned")}
            </span>
          </button>
          {price != null && (
            <span className="text-xs font-semibold text-primary">
              £{Number(price).toFixed(0)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
