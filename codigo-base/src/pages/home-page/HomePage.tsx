import "./HomePage.css";
import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import CategoriesSection from "./components/CategoriesSection";
import FeaturedCoursesSection from "./components/FeaturedCoursesSection";
import HowItWorksSection from "./components/HowItWorksSection";
import GamificationSection from "./components/GamificationSection";
import TestimonialsSection from "./components/TestimonialsSection";
import CtaSection from "./components/CtaSection";
import Footer from "./components/Footer";

export default function HomePage() {
  return (
    <div
      className="min-h-screen w-full overflow-x-hidden"
      style={{ fontFamily: "var(--font-body)", background: "#0E0820", color: "#F4EEFF" }}
    >
      <Header />
      <HeroSection />
      <CategoriesSection />
      <FeaturedCoursesSection />
      <HowItWorksSection />
      <GamificationSection />
      <TestimonialsSection />
      <CtaSection />
      <Footer />
    </div>
  );
}
