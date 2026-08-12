import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { BUSINESS, IMAGES } from "@/lib/siteContent";
import SEOHead from "@/components/SEOHead";
import { Phone, MessageCircle, Mail, MapPin, Send } from "lucide-react";
import { apiRequest } from "@/lib/apiClient";
import { useSiteImages } from "@/hooks/useSiteImages";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  phone: z.string().trim().min(1, "Phone number is required").max(20),
  message: z.string().trim().min(1, "Message is required").max(2000),
});

const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const siteImages = useSiteImages();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest("/api/contact", {
        method: "POST",
        body: JSON.stringify(form),
      });

      setSubmitted(true);
      toast.success("Message sent! We'll be in touch shortly.");
    } catch (err: any) {
      console.error(err);
      toast.error("Something went wrong. Please try calling us instead.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Contact Us | Wub Hair"
        description="Get in touch with Wub Hair. Call, email, WhatsApp or fill in our contact form. We respond within hours."
        canonical="/contact"
        image={IMAGES.heroBooking}
      />

      {/* JSON-LD ContactPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ContactPage",
            name: "Contact Wub Hair",
            url: `${window.location.origin}/contact`,
            mainEntity: {
              "@type": "HairSalon",
              name: BUSINESS.name,
              telephone: BUSINESS.phone,
              email: BUSINESS.email,
              address: {
                "@type": "PostalAddress",
                streetAddress: "174 Claremont Road",
                addressLocality: "Manchester",
                addressRegion: "Greater Manchester",
                postalCode: "M14 4TT",
                addressCountry: "GB",
              },
            },
          }),
        }}
      />
      {/* Hero */}
      <section
        className="relative py-20 md:py-28 bg-cover bg-center"
        style={{ backgroundImage: `url(${siteImages.getImage("heroBooking", IMAGES.heroBooking)})` }}
      >
        <div className="absolute inset-0 bg-black/70" />
        <div className="container relative z-10 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">Contact Us</h1>
          <p className="text-lg text-white/80 max-w-xl mx-auto">
            Have a question or need help? Drop us a message and we'll get back to you quickly.
          </p>
        </div>
      </section>

      <section className="container py-14 grid gap-10 md:grid-cols-2">
        {/* Contact Info */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Get In Touch</h2>
          <p className="text-muted-foreground">
            Reach out by phone, WhatsApp, email, or fill in the form and we'll respond within a few hours.
          </p>

          <div className="space-y-4">
            <a href={BUSINESS.phoneHref} className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Call Us</p>
                <p className="text-sm text-muted-foreground">{BUSINESS.phone}</p>
              </div>
            </a>

            <a href={BUSINESS.whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#25D366]/10">
                <MessageCircle className="h-5 w-5 text-[#25D366]" />
              </div>
              <div>
                <p className="font-medium">WhatsApp</p>
                <p className="text-sm text-muted-foreground">Message us on WhatsApp</p>
              </div>
            </a>

            <a href={`mailto:${BUSINESS.email}`} className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{BUSINESS.email}</p>
              </div>
            </a>

            <div className="flex items-center gap-3 p-4 rounded-lg border border-border">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Salon Address</p>
                <p className="text-sm text-muted-foreground">{BUSINESS.address}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        {submitted ? (
          <Card className="flex flex-col items-center justify-center text-center p-10">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Send className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl mb-2">Message Sent!</CardTitle>
            <CardDescription className="text-base">
              Thanks {form.name}, we've received your message and will be in touch shortly.
            </CardDescription>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Send Us a Message</CardTitle>
              <CardDescription>Fill in the form below and we'll get back to you.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} />
                </div>
                <div>
                  <Label htmlFor="phone">Phone *</Label>
                  <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required maxLength={20} />
                </div>
                <div>
                  <Label htmlFor="message">Your Message *</Label>
                  <Textarea id="message" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required maxLength={2000} />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={submitting}>
                  <Send className="h-4 w-4" />
                  {submitting ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Google Maps */}
      <section className="container pb-14">
        <div className="rounded-xl overflow-hidden border border-border">
          <iframe
            src="https://www.google.com/maps?q=174+Claremont+Road,+Manchester+M14+4TT&output=embed"
            width="100%"
            height="400"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Wub Hair Salon Location"
          />
        </div>
      </section>
    </>
  );
};

export default Contact;
