import { generateTts } from './tts.mjs';
import { recordDemo } from './record-demo.mjs';
import { recordSite } from './record-site.mjs';
import { composeAll } from './compose.mjs';

const steps = process.argv.slice(2);
const want = new Set(steps.length ? steps : ['tts', 'demo', 'site', 'compose']);

try {
  if (want.has('tts')) {
    console.log('\n== TTS ==');
    generateTts();
  }
  if (want.has('demo')) {
    console.log('\n== Record live wallet ==');
    await recordDemo();
  }
  if (want.has('site')) {
    console.log('\n== Record 1337wallet.io ==');
    await recordSite();
  }
  if (want.has('compose')) {
    console.log('\n== Compose ==');
    composeAll();
  }
  console.log('\nDone. Upload brand/ethglobal/1337-demo.mp4 and brand/ethglobal/1337-pitch.mp4 to YouTube, Loom, or Vimeo.');
} catch (err) {
  console.error(err);
  process.exit(1);
}
