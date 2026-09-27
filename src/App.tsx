import { Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import PublicLayout from "@/components/PublicLayout";
import ScrollToTop from "@/components/ScrollToTop";
import HomePage from "@/pages/HomePage";
import ServicesDirectory from "@/pages/ServicesDirectory";
import ServicePage from "@/pages/ServicePage";
import Gallery from "@/pages/Gallery";
import Contact from "@/pages/Contact";
import LocationPage from "@/pages/LocationPage";
import NotFound from "@/pages/NotFound";

// Marketing pages only. Booking, payment, accounts and the salon CRM all live in
// WubSync (booking.eandbhair.co.uk); retired local routes are redirected by the
// server (server/index.js).
const App = () => (
  <TooltipProvider>
    <Sonner />
    <ScrollToTop />
    <PublicLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesDirectory />} />
        <Route path="/services/:service" element={<ServicePage />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/areas/:borough" element={<LocationPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </PublicLayout>
  </TooltipProvider>
);

export default App;
