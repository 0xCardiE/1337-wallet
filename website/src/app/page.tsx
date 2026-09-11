import { ContactSection } from '@/components/ContactSection';
import { Hero } from '@/components/Hero';
import { InstallSection } from '@/components/InstallSection';
import { PrivacySection } from '@/components/PrivacySection';
import { VideoSection } from '@/components/VideoSection';

export default function HomePage() {
  return (
    <>
      <Hero />
      <VideoSection />
      <InstallSection />
      <PrivacySection />
      <ContactSection />
    </>
  );
}
