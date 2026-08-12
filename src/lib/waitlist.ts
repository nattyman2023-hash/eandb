import { api } from "@/lib/apiClient";

export interface WaitlistPatch {
  client_name?: string;
  phone?: string | null;
  notes?: string | null;
  estimated_wait_minutes?: number;
  service_catalog_id?: string | null;
  assigned_chair_id?: string | null;
  status?: "waiting" | "assigned" | "completed" | "cancelled";
  position?: number;
}

export async function updateWaitlist(id: string, patch: WaitlistPatch) {
  const { error } = await api.from("waitlist").update(patch).eq("id", id);
  if (error) throw error;
}

export async function reorderWaitlist(orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, idx) => api.from("waitlist").update({ position: idx }).eq("id", id))
  );
}

export async function removeWaitlist(id: string) {
  await api.from("waitlist").update({ status: "cancelled" }).eq("id", id);
}
