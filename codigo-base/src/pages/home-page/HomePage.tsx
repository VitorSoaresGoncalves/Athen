import { useState } from "react";
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
import { useHomeData, useMe } from "./hooks";

export default function HomePage() {
  const [category, setCategory] = useState<string | null>(null);
  const me = useMe();
  const { stats, categories, courses, learners, testimonials } = useHomeData(category);

  const toggleCategory = (label: string) => setCategory((current) => (current === label ? null : label));

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden"
      style={{ fontFamily: "var(--font-body)", background: "#0E0820", color: "#F4EEFF" }}
    >
      <Header me={me.profile} loggedIn={me.loggedIn} sessionReady={me.ready} onSignOut={() => void me.signOut()} />
      <HeroSection stats={stats.data} loading={stats.loading} loggedIn={me.loggedIn} />
      <CategoriesSection
        categories={categories.data ?? []}
        loading={categories.loading}
        error={categories.error}
        selected={category}
        onSelect={toggleCategory}
      />
      <FeaturedCoursesSection
        courses={courses.data ?? []}
        loading={courses.loading}
        error={courses.error}
        category={category}
        loggedIn={me.loggedIn}
        onClearCategory={() => setCategory(null)}
      />
      <HowItWorksSection />
      <GamificationSection
        learner={me.profile ?? learners.data?.[0] ?? null}
        leaderXp={learners.data?.[0]?.xp ?? 0}
        isMine={!!me.profile}
        loading={learners.loading || (me.loggedIn && !me.profile)}
      />
      <TestimonialsSection testimonials={testimonials.data ?? []} learners={learners.data ?? []} loading={testimonials.loading || learners.loading} />
      <CtaSection students={stats.data?.students ?? 0} loggedIn={me.loggedIn} />
      <Footer />
    </div>
  );
}
