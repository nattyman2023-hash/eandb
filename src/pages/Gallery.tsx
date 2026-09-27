import { Link } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import BookNow from "@/components/BookNow";
import { useCatalogue } from "@/lib/catalogue";
import { breadcrumbJsonLd } from "@/lib/seo";

import heroCornrows from "@/assets/home-cover-cornrows.jpg";
import braidingChair from "@/assets/home-braiding-chair.jpg";

// Style inspiration drawn from the same cover images WubSync shows for each
// category, so the gallery always lines up with services that can actually be booked.
const Gallery = () => {
  const { catalogue } = useCatalogue();
  const categoryImages = catalogue.categories
    .filter((category) => category.cover)
    .map((category) => ({
      key: category.slug,
      src: category.cover!.image,
      alt: category.cover!.alt,
      caption: category.name,
      href: `/services#${category.slug}`,
    }));

  const images = [
    { key: "cornrows-feature", src: heroCornrows, alt: "Neat cornrows braided back into long braids", caption: "Cornrows", href: "/services#cornrows" },
    ...categoryImages,
    { key: "braiding", src: braidingChair, alt: "A stylist braiding a client's hair", caption: "In the chair", href: "/services" },
  ];

  return (
    <>
      <SEOHead
        title="Style Gallery | E & B Hair, Manchester"
        description="Style inspiration from E & B Hair: knotless braids, box braids, cornrows, twists, locs and children's styles. Find a look, then book online."
        canonical="/gallery"
        image={heroCornrows}
        jsonLd={[breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Gallery", path: "/gallery" }])]}
      />

      <section className="border-t border-border">
        <div className="container py-12 lg:py-16 max-w-3xl">
          <p className="eyebrow mb-4">Gallery</p>
          <h1 className="display-lg mb-6">Style inspiration.</h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl">
            Browse the styles we offer. Tap any image to see the services, starting prices and estimated durations for that style.
          </p>
        </div>
      </section>

      <div className="container">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
          {images.map((image) => (
            <Link key={image.key} to={image.href} className="group block">
              <div className="aspect-[4/5] bg-muted overflow-hidden">
                <img
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <p className="mt-2 text-sm group-hover:text-primary transition-colors">{image.caption}</p>
            </Link>
          ))}
        </div>

        <div className="section-y text-center space-y-6">
          <h2 className="display-md">Found your style?</h2>
          <BookNow size="lg" />
        </div>
      </div>
    </>
  );
};

export default Gallery;
