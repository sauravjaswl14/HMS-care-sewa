import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Beat from '@/components/Beat';
import Booking from '@/components/Booking';
import Departments from '@/components/Departments';
import Journey from '@/components/Journey';
import Modules from '@/components/Modules';
import Guardrails from '@/components/Guardrails';
import Faq from '@/components/Faq';
import FinalCta from '@/components/FinalCta';
import Footer from '@/components/Footer';
import ScrollProgress from '@/components/ScrollProgress';
import SmoothScroll from '@/components/SmoothScroll';
import Providers from '@/components/Providers';

export default function Page() {
  return (
    <Providers>
      <SmoothScroll />
      <ScrollProgress />
      <Header />
      <main>
        <Hero />
        <Beat />
        <Booking />
        <Departments />
        <Journey />
        <Modules />
        <Guardrails />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </Providers>
  );
}
