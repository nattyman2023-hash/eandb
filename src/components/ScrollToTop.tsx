import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Scroll to the top on navigation, or to the #anchor when the link has one
// (e.g. /services#knotless from the footer).
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}
