import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { Heart, Camera } from "lucide-react";
import type { JobPhoto } from "@/types/database";

const PortalStyleDiary = () => {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<(JobPhoto & { url: string; jobNote?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: cust } = await api.from("customers").select("id").eq("user_id", user.id).single();
      if (!cust) { setLoading(false); return; }

      const { data: jobIds } = await api.from("jobs").select("id").eq("customer_id", cust.id);
      if (!jobIds?.length) { setLoading(false); return; }

      const ids = jobIds.map((j: any) => j.id);
      const { data: photoData } = await api.from("job_photos")
        .select("*")
        .in("job_id", ids)
        .eq("visible_to_customer", true)
        .order("created_at", { ascending: false });

      // Fetch latest note per job for "stylist notes"
      const { data: notes } = await api.from("job_notes").select("job_id, content").in("job_id", ids).order("created_at", { ascending: false });
      const noteMap: Record<string, string> = {};
      (notes ?? []).forEach((n: any) => { if (!noteMap[n.job_id]) noteMap[n.job_id] = n.content; });

      const enriched = (photoData ?? []).map((p: any) => {
        const { data: urlData } = api.storage.from("job-photos").getPublicUrl(p.storage_path);
        return { ...p, url: urlData?.publicUrl || "", jobNote: noteMap[p.job_id] };
      });
      setPhotos(enriched as any);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <div className="text-center py-20 text-[#6B7280]">Loading your style diary...</div>;

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-serif text-[#1A2B42]">Style Diary</h1>
        <p className="text-sm text-[#6B7280] mt-1">Your personal gallery of looks crafted by our stylists.</p>
      </div>

      {/* Hair Profile Card */}
      <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5 space-y-3">
        <p className="text-xs uppercase tracking-widest text-[#A68966]">My Hair Profile</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-[#F5F3EE] rounded-xl p-3">
            <p className="text-xs text-[#6B7280]">Hair Type</p>
            <p className="text-[#1A2B42] font-medium">Not set</p>
          </div>
          <div className="bg-[#F5F3EE] rounded-xl p-3">
            <p className="text-xs text-[#6B7280]">Sensitivities</p>
            <p className="text-[#1A2B42] font-medium">None noted</p>
          </div>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="bg-white border border-[#E8E4DD] rounded-2xl p-12 text-center">
          <Camera className="h-10 w-10 text-[#E8E4DD] mx-auto mb-3" />
          <p className="text-[#6B7280]">No style photos yet.</p>
          <p className="text-xs text-[#A68966] mt-1">Your stylist will upload photos after your next visit.</p>
        </div>
      ) : (
        <>
          {/* Masonry Grid */}
          <div className="columns-2 sm:columns-3 gap-3 space-y-3">
            {photos.map(photo => (
              <div key={photo.id} className="break-inside-avoid bg-white border border-[#E8E4DD] rounded-2xl overflow-hidden">
                <img src={photo.url} alt={photo.caption || "Style"} className="w-full object-cover" />
                {(photo.caption || photo.jobNote) && (
                  <div className="p-3">
                    {photo.caption && <p className="text-sm text-[#1A2B42] font-medium">{photo.caption}</p>}
                    {photo.jobNote && (
                      <div className="mt-2 bg-[#F5F3EE] rounded-lg p-2">
                        <p className="text-xs text-[#A68966] uppercase tracking-wider mb-0.5">Stylist Note</p>
                        <p className="text-xs text-[#6B7280]">{photo.jobNote}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PortalStyleDiary;
