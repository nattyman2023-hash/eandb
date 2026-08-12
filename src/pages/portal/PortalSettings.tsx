import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Lock, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

const PortalSettings = () => {
  const { user, profile } = useAuth();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: cust } = await api.from("customers").select("id, name, phone, email").eq("user_id", user.id).single();
      if (cust) {
        setCustomerId(cust.id);
        setForm({ name: cust.name || "", phone: cust.phone || "", email: cust.email || "" });
      }
    };
    load();
  }, [user]);

  const saveProfile = async () => {
    if (!customerId) return;
    setSaving(true);
    await api.from("customers").update({ name: form.name, phone: form.phone, email: form.email }).eq("id", customerId);
    toast.success("Profile updated");
    setSaving(false);
  };

  const changePassword = async () => {
    if (pwForm.newPw !== pwForm.confirm) { toast.error("Passwords don't match"); return; }
    if (pwForm.newPw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    const { error } = await api.auth.updateUser({ password: pwForm.newPw });
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    setPwForm({ current: "", newPw: "", confirm: "" });
  };

  return (
    <div className="space-y-6 pb-20 max-w-lg">
      <h1 className="text-2xl font-serif text-[#1A2B42]">Account Settings</h1>

      {/* Profile */}
      <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-full bg-[#A68966]/10 flex items-center justify-center">
            <User className="h-6 w-6 text-[#A68966]" />
          </div>
          <div>
            <p className="font-medium text-[#1A2B42]">{form.name || user?.email}</p>
            <p className="text-xs text-[#6B7280]">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-[#6B7280]">Full Name</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="border-[#E8E4DD]" />
          </div>
          <div>
            <Label className="text-xs text-[#6B7280]">Phone</Label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="border-[#E8E4DD]" />
          </div>
          <div>
            <Label className="text-xs text-[#6B7280]">Email</Label>
            <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="border-[#E8E4DD]" />
          </div>
          <Button onClick={saveProfile} disabled={saving} className="w-full bg-[#A68966] hover:bg-[#8B7355]">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Password */}
      <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-[#A68966]" />
          <p className="text-sm font-medium text-[#1A2B42]">Change Password</p>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-[#6B7280]">New Password</Label>
            <Input type="password" value={pwForm.newPw} onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })} className="border-[#E8E4DD]" />
          </div>
          <div>
            <Label className="text-xs text-[#6B7280]">Confirm Password</Label>
            <Input type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} className="border-[#E8E4DD]" />
          </div>
          <Button onClick={changePassword} variant="outline" className="w-full border-[#A68966] text-[#A68966]">
            Update Password
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PortalSettings;
