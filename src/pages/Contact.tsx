import { Phone, MessageCircle, Mail, MapPin, CalendarCheck } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import BookNow from "@/components/BookNow";
import { BUSINESS, whatsappLink } from "@/lib/siteContent";
import { breadcrumbJsonLd, BUSINESS_ID } from "@/lib/seo";

// Enquiries go straight to E & B by email, WhatsApp or phone. There is no web form:
// this site has no mail provider or database to receive one, and a form that
// silently failed would be worse than none. Appointments are booked in WubSync.
const Contact = () => {
  const channels = [
    { href: `mailto:${BUSINESS.email}?subject=${encodeURIComponent("Enquiry for E & B Hair")}`, icon: Mail, title: "Email", detail: BUSINESS.email, action: "Write an email" },
    { href: whatsappLink(), icon: MessageCircle, title: "WhatsApp", detail: BUSINESS.phone, action: "Send a message", external: true },
    { href: BUSINESS.phoneHref, icon: Phone, title: "Phone", detail: BUSINESS.phone, action: "Call us" },
    { href: BUSINESS.mapsUrl, icon: MapPin, title: "Find the salon", detail: BUSINESS.address, action: "Directions", external: true },
  ];

  return (
    <>
      <SEOHead
        title="Contact E & B Hair | Manchester Braiding Salon"
        description={`Questions for E & B Hair? Email, WhatsApp or call us. Find us at ${BUSINESS.address}.`}
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
            Ask us about styles, sizes, hair or anything else by email, WhatsApp or phone. To make an appointment, use our online booking page.
          </p>
        </div>
      </section>

      <section className="container grid gap-10 lg:grid-cols-2 pb-14">
        <ul className="space-y-3">
          {channels.map(({ href, icon: Icon, title, detail, action, external }) => (
            <li key={title}>
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="flex items-center gap-4 p-4 border border-border hover:bg-muted transition-colors"
              >
                <Icon className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{title}</span>
                  <span className="block text-sm text-muted-foreground break-words">{detail}</span>
                </span>
                <span className="hidden sm:block shrink-0 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{action}</span>
              </a>
            </li>
          ))}
        </ul>

        <div className="border border-border p-6 flex flex-col gap-4 justify-between">
          <div className="flex items-start gap-3">
            <CalendarCheck className="h-5 w-5 text-primary shrink-0 mt-1" aria-hidden="true" />
            <div>
              <p className="font-display text-2xl">Want to book?</p>
              <p className="text-muted-foreground mt-1">Choose your service, options, date and time online. Your price is confirmed before you book.</p>
            </div>
          </div>
          <BookNow size="lg" className="w-full sm:w-auto sm:self-start" />
        </div>
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
