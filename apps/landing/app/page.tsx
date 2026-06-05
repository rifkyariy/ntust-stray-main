import { MHeader } from '../components/MHeader';
import { Hero } from '../components/Hero';
import { HowItWorks } from '../components/HowItWorks';
import { ImpactStrip } from '../components/ImpactStrip';
import { StationsSection } from '../components/StationsSection';
import { Footer } from '../components/Footer';

export default function HomePage() {
  return (
    <>
      <MHeader />
      <Hero />
      <HowItWorks />
      <ImpactStrip />
      <StationsSection />
      <Footer />
    </>
  );
}
