import { api } from "@/lib/apiClient";

export type BookingStatus = "pending" | "confirmed" | "in_progress" | "completed" | "paid" | "cancelled" | "no_show";

interface UpdateBookingInput {
  scheduled_at?: string | null;
  assigned_to?: string | null;
  status?: BookingStatus;
  notes?: string;
}

/**
 * Update a booking and append an audit note.
 */
export async function updateBooking(jobId: string, patch: UpdateBookingInput, auditNote?: string) {
  const { error } = await api.from("jobs").update(patch).eq("id", jobId);
  if (error) throw error;
  if (auditNote) {
    const { data: { user } } = await (api.auth.getUser());
    await api.from("job_notes").insert({
      job_id: jobId,
      author_id: user?.id ?? null,
      content: auditNote,
    });
  }
}

export async function reschedule(jobId: string, newDate: Date, stylistId: string | null) {
  return updateBooking(
    jobId,
    { scheduled_at: newDate.toISOString(), assigned_to: stylistId },
    `Rescheduled to ${newDate.toLocaleString()}`
  );
}

export async function setStatus(jobId: string, status: BookingStatus) {
  return updateBooking(jobId, { status }, `Status → ${status.replace("_", " ")}`);
}

export async function updateCustomer(customerId: string, patch: { name?: string; phone?: string; email?: string; postcode?: string }) {
  const { error } = await api.from("customers").update(patch).eq("id", customerId);
  if (error) throw error;
}

export async function addNote(jobId: string, content: string) {
  const { data: { user } } = await (api.auth.getUser());
  await api.from("job_notes").insert({ job_id: jobId, author_id: user?.id ?? null, content });
}

/** Find existing customer by phone or email, otherwise create one. */
export async function findOrCreateCustomer(input: { name: string; phone?: string; email?: string; postcode?: string }) {
  if (input.phone) {
    const { data } = await api.from("customers").select("*").eq("phone", input.phone).limit(1).maybeSingle();
    if (data) return data;
  }
  if (input.email) {
    const { data } = await api.from("customers").select("*").eq("email", input.email).limit(1).maybeSingle();
    if (data) return data;
  }
  const { data, error } = await api.from("customers").insert({
    name: input.name,
    phone: input.phone || "",
    email: input.email || "",
    postcode: input.postcode || "",
  }).select("*").single();
  if (error) throw error;
  return data;
}

export async function searchCustomers(query: string, limit = 8) {
  const q = query.trim();
  if (!q) return [];
  const { data } = await api
    .from("customers")
    .select("id, name, phone, email")
    .or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(limit);
  return data ?? [];
}
