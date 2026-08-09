import { ContactSection } from '@/components/ContactSection';
import { FeatureGrid } from '@/components/FeatureGrid';
import { Hero } from '@/components/Hero';
import { PrivacySection } from '@/components/PrivacySection';
import { ToolsSection } from '@/components/ToolsSection';
import { VideoSection } from '@/components/VideoSection';

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureGrid />
      <ToolsSection />
      <VideoSection />
      <PrivacySection />
      <ContactSection />
    </>
  );
}
