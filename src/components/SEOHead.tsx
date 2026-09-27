import { Helmet } from "react-helmet-async";
import { absoluteUrl, DEFAULT_SHARE_IMAGE } from "@/lib/seo";

interface SEOHeadProps {
  title: string;
  description: string;
  /** Path on eandbhair.co.uk. Omit only for noindex pages. */
  canonical?: string;
  image?: string;
  type?: string;
  jsonLd?: object[];
  noindex?: boolean;
}

// Rendered into the prerendered HTML at build time (scripts/prerender.mjs), so
// crawlers see the title, canonical and structured data without running JS.
const SEOHead = ({ title, description, canonical, image, type = "website", jsonLd = [], noindex = false }: SEOHeadProps) => {
  const url = canonical && !noindex ? absoluteUrl(canonical) : undefined;
  const shareImage = image ? absoluteUrl(image) : DEFAULT_SHARE_IMAGE;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noindex ? "noindex, follow" : "index, follow"} />
      {url && <link rel="canonical" href={url} />}
      <meta property="og:site_name" content="E & B Hair" />
      <meta property="og:locale" content="en_GB" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      {url && <meta property="og:url" content={url} />}
      <meta property="og:image" content={shareImage} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={shareImage} />
      {jsonLd.map((data, index) => (
        <script key={index} type="application/ld+json">{JSON.stringify(data)}</script>
      ))}
    </Helmet>
  );
};

export default SEOHead;
