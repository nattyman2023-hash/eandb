import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Phone, MessageCircle, Mail, MapPin, Send, CalendarCheck } from "lucide-react";
import { z } from "zod";
import SEOHead from "@/components/SEOHead";
import BookNow from "@/components/BookNow";
import { BUSINESS, whatsappLink } from "@/lib/siteContent";
import { breadcrumbJsonLd, BUSINESS_ID } from "@/lib/seo";

const enquirySchema = z.object({
  name: z.string().trim().min(1, "Please tell us your name").max(100),
  email: z.string().trim().email("Please enter a valid email address").max(255),
  phone: z.string().trim().max(40),
  message: z.string().trim().min(1, "Please write your question").max(2000),
});

// Enquiries only. Appointments are booked in WubSync, never through this form.
const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "", website: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = enquirySchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(`Enquiry failed (${response.status})`);
      setSubmitted(true);
    } catch {
      toast.error(`We couldn't send your message. Please call ${BUSINESS.phone} or email ${BUSINESS.email}.`);
    } finally {
      setSubmitting(false);
    }
  };

  const channels = [
    { href: BUSINESS.phoneHref, icon: Phone, title: "Call us", detail: BUSINESS.phone },
    { href: whatsappLink(), icon: MessageCircle, title: "WhatsApp", detail: "Send us a question", external: true },
    { href: `mailto:${BUSINESS.email}`, icon: Mail, title: "Email", detail: BUSINESS.email },
    { href: BUSINESS.mapsUrl, icon: MapPin, title: "Find the salon", detail: BUSINESS.address, external: true },
  ];

  return (
    <>
      <SEOHead
        title="Contact E & B Hair | Manchester Braiding Salon"
        description={`Questions for E & B Hair? Call, email or WhatsApp us, or send a message. Find us at ${BUSINESS.address}.`}
        canonical="/contact"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "ContactPage",
            name: "Contact E & B Hair",
            url: "https://eandbhair.co.uk/contact",
            mainEntity: { "@id": BUSINESS_ID },
          },
          breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }]),
        ]}
      />

      <section className="border-t border-border">
        <div className="container py-12 lg:py-16 max-w-3xl">
          <p className="eyebrow mb-4">Contact</p>
          <h1 className="display-lg mb-6">Questions? We're happy to help.</h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl">
            Ask us about styles, sizes, hair or anything else. To make an appointment, use our online booking page.
          </p>
        </div>
      </section>

      <section className="container grid gap-10 lg:grid-cols-2 pb-14">
        <div className="space-y-6">
          <div className="border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="flex items-start gap-3">
              <CalendarCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-medium">Want to book?</p>
                <p className="text-sm text-muted-foreground">Choose your service, date and time online.</p>
              </div>
            </div>
            <BookNow className="shrink-0" />
          </div>

          <ul className="space-y-3">
            {channels.map(({ href, icon: Icon, title, detail, external }) => (
              <li key={title}>
                <a
                  href={href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex items-center gap-4 p-4 border border-border hover:bg-muted transition-colors"
                >
                  <Icon className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-medium">{title}</span>
                    <span className="block text-sm text-muted-foreground break-words">{detail}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {submitted ? (
          <div className="border border-border p-10 flex flex-col items-center justify-center text-center gap-4" role="status">
            <Send className="h-8 w-8 text-primary" aria-hidden="true" />
            <p className="font-display text-2xl">Message sent</p>
            <p className="text-muted-foreground">Thanks {form.name}, we'll reply as soon as we can.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="border border-border p-6 space-y-4" noValidate>
            <div>
              <p className="font-display text-2xl">Send us a message</p>
              <p className="text-sm text-muted-foreground mt-1">For questions and enquiries. This form does not book an appointment.</p>
            </div>
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} />
            </div>
            <div>
              <Label htmlFor="message">Your question *</Label>
              <Textarea id="message" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required maxLength={2000} />
            </div>
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Leave this empty</label>
              <input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex h-11 items-center justify-center gap-2 bg-foreground text-background text-[11px] uppercase tracking-[0.22em] font-medium hover:bg-foreground/90 transition-colors disabled:opacity-60"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {submitting ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </section>

      <section className="container pb-4">
        <div className="overflow-hidden border border-border">
          <iframe
            src={BUSINESS.mapsEmbedUrl}
            width="100%"
            height="400"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Map showing ${BUSINESS.name} at ${BUSINESS.address}`}
          />
        </div>
      </section>
    </>
  );
};

export default Contact;
