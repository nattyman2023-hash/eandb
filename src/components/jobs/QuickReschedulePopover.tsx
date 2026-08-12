import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";

interface Props {
  jobId: string;
  scheduledAt: string | null;
  onSaved?: () => void;
}

export default function QuickReschedulePopover({ jobId, scheduledAt, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const initial = scheduledAt ? new Date(scheduledAt) : new Date();
  const [date, setDate] = useState(format(initial, "yyyy-MM-dd"));
  const [time, setTime] = useState(format(initial, "HH:mm"));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const iso = new Date(`${date}T${time}:00`).toISOString();
    const { error } = await api.from("jobs").update({ scheduled_at: iso }).eq("id", jobId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Rescheduled");
    setOpen(false);
    onSaved?.();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition"
          title="Quick reschedule"
        >
          <Clock className="h-3 w-3" />
          {scheduledAt ? format(new Date(scheduledAt), "HH:mm") : "Set time"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-semibold">Quick reschedule</p>
        <div className="space-y-1.5">
          <Label className="text-[11px]">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px]">Time (5-min steps)</Label>
          <Input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} className="h-8" />
        </div>
        <Button size="sm" className="w-full h-8" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
