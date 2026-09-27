import { Link } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import BookNow from "@/components/BookNow";

const NotFound = () => (
  <>
    <SEOHead
      title="Page not found | E & B Hair"
      description="This page could not be found. Browse E & B Hair services or book online."
      noindex
    />
    <section className="border-t border-border">
      <div className="container py-20 lg:py-28 max-w-2xl space-y-6">
        <p className="eyebrow">404</p>
        <h1 className="display-lg">We couldn't find that page.</h1>
        <p className="text-muted-foreground">It may have moved. Our services and prices are all on one page, and you can book online at any time.</p>
        <div className="flex flex-wrap items-center gap-6">
          <BookNow />
          <Link to="/services" className="marker-link">View services</Link>
          <Link to="/" className="marker-link">Home</Link>
        </div>
      </div>
    </section>
  </>
);

export default NotFound;
