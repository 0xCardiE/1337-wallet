import { SITE } from '@/lib/site';

export function ChromeDownload({ className = 'btn-primary' }: { className?: string }) {
  return (
    <a
      href={SITE.chromeStoreUrl}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
    >
      Download for Chrome
    </a>
  );
}

export function DiscordJoin({
  className = 'btn-primary',
  children = 'Join Discord',
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a href={SITE.discordUrl} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
