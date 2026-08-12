import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { IMAGES, BOROUGHS, SERVICES } from "@/lib/siteContent";
import { toast } from "sonner";

export interface ImageSlot {
  key: string;
  label: string;
  fallback: string;
  group: "global" | "borough" | "service";
}

// Build all image slots from site content
const GLOBAL_SLOTS: ImageSlot[] = [
  { key: "heroHome", label: "Homepage Hero", fallback: IMAGES.heroHome, group: "global" },
  { key: "heroBooking", label: "Booking Hero", fallback: IMAGES.heroBooking, group: "global" },
  { key: "trustLifestyle", label: "Why Choose Us", fallback: IMAGES.trustLifestyle, group: "global" },
  { key: "ctaBg", label: "CTA Background", fallback: IMAGES.ctaBg, group: "global" },
  { key: "manchesterCity", label: "Manchester City", fallback: IMAGES.manchesterCity, group: "global" },
];

const BOROUGH_SLOTS: ImageSlot[] = BOROUGHS.map((b) => ({
  key: `borough.${b.slug}`,
  label: b.name,
  fallback: b.image,
  group: "borough" as const,
}));

const SERVICE_SLOTS: ImageSlot[] = SERVICES.map((s) => ({
  key: `service.${s.slug}`,
  label: s.name,
  fallback: s.image,
  group: "service" as const,
}));

export const ALL_IMAGE_SLOTS = [...GLOBAL_SLOTS, ...BOROUGH_SLOTS, ...SERVICE_SLOTS];

export function useSiteImages() {
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  // Fetch all image.* settings
  useEffect(() => {
    const fetch = async () => {
      const { data } = await api
        .from("settings")
        .select("key, value")
        .like("key", "image.%");
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((row) => {
          // key format: "image.heroHome" → strip "image." prefix
          map[row.key.replace("image.", "")] = row.value;
        });
        setOverrides(map);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const getImage = useCallback(
    (key: string, fallback?: string): string => {
      if (overrides[key]) return overrides[key];
      const slot = ALL_IMAGE_SLOTS.find((s) => s.key === key);
      return fallback || slot?.fallback || "/placeholder.svg";
    },
    [overrides]
  );

  const uploadImage = useCallback(
    async (key: string, file: File) => {
      setUploading(key);
      try {
        const ext = file.name.split(".").pop();
        const path = `${key.replace(/\./g, "/")}/${Date.now()}.${ext}`;

        const { error: uploadError } = await api.storage
          .from("site-images")
          .upload(path, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = api.storage
          .from("site-images")
          .getPublicUrl(path);

        const publicUrl = urlData.publicUrl;
        const settingsKey = `image.${key}`;

        // Upsert into settings
        const { error: upsertError } = await api
          .from("settings")
          .upsert({ key: settingsKey, value: publicUrl }, { onConflict: "key" });

        if (upsertError) throw upsertError;

        setOverrides((prev) => ({ ...prev, [key]: publicUrl }));
        toast.success("Image updated");
      } catch (err: any) {
        toast.error(err.message || "Upload failed");
      } finally {
        setUploading(null);
      }
    },
    []
  );

  return { overrides, loading, uploading, getImage, uploadImage, slots: ALL_IMAGE_SLOTS };
}
