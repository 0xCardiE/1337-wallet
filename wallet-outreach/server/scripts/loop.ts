import { runTick } from '../agent.js';
import { loadStore } from '../storage.js';

const store = await loadStore();
const minutes = Math.max(5, store.settings.loopMinutes || 10);
console.log(
  `Outreach loop every ${minutes} min. Autopilot ${store.settings.autopilot ? 'on' : 'off'}. Dry run ${store.settings.dryRun ? 'on' : 'off'}.`,
);
await runTick();
setInterval(() => {
  void runTick().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
  });
}, minutes * 60_000);
