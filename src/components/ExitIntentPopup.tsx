import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUSINESS } from "@/lib/siteContent";
import { CalendarCheck, PhoneCall, MessageCircle, Phone } from "lucide-react";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const ExitIntentPopup = () => {
  const [open, setOpen] = useState(false);
  const [showCallback, setShowCallback] = useState(false);
  const [cbForm, setCbForm] = useState({ name: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.clientY <= 0 && !sessionStorage.getItem("exit-intent-shown")) {
        setOpen(true);
        sessionStorage.setItem("exit-intent-shown", "true");
      }
    };
    document.addEventListener("mouseout", handler);
    return () => document.removeEventListener("mouseout", handler);
  }, []);

  const handleCallback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cbForm.name.trim() || !cbForm.phone.trim()) {
      toast.error("Please enter your name and phone number.");
      return;
    }
    setSubmitting(true);
    try {
      if (user) {
        // Authenticated user — find their customer record and create a job
        const { data: customer } = await api
          .from("customers")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (customer) {
          await api.from("jobs").insert({
            customer_id: customer.id,
            status: "pending",
            notes: "Client requested callback via exit intent.",
            source: "Exit Intent Callback",
          });
        }
      } else {
        // Anonymous user — create a lead
        await api.from("leads").insert({
          name: cbForm.name.trim(),
          phone: cbForm.phone.trim(),
          source: "Exit Intent Callback",
          status: "New",
          service_requested: "Callback Request",
        });
      }

      toast.success("Got it! A stylist from E and B will be in touch shortly.");
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please call us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Before You Go… 👋</DialogTitle>
          <DialogDescription>
            Need help with your hair? We're here for you — choose how you'd like to connect.
          </DialogDescription>
        </DialogHeader>

        {showCallback ? (
          <form onSubmit={handleCallback} className="space-y-3 pt-2">
            <div>
              <Label htmlFor="cb-name">Your Name</Label>
              <Input id="cb-name" value={cbForm.name} onChange={(e) => setCbForm({ ...cbForm, name: e.target.value })} required maxLength={100} />
            </div>
            <div>
              <Label htmlFor="cb-phone">Phone Number</Label>
              <Input id="cb-phone" type="tel" value={cbForm.phone} onChange={(e) => setCbForm({ ...cbForm, phone: e.target.value })} required maxLength={20} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCallback(false)}>Back</Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? "Sending…" : "Request Callback"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid gap-2 pt-2">
            <Link to="/book" onClick={() => setOpen(false)}>
              <Button variant="default" className="w-full justify-start gap-3">
                <CalendarCheck className="h-4 w-4" /> Book an Appointment
              </Button>
            </Link>
            <Button variant="outline" className="w-full justify-start gap-3" onClick={() => setShowCallback(true)}>
              <PhoneCall className="h-4 w-4" /> Request a Callback
            </Button>
            <a href={BUSINESS.whatsapp} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full justify-start gap-3">
                <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
              </Button>
            </a>
            <a href={BUSINESS.phoneHref}>
              <Button variant="outline" className="w-full justify-start gap-3">
                <Phone className="h-4 w-4" /> Call Us Now
              </Button>
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExitIntentPopup;
