import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { Moment, Source, Tone } from './types.js';
import { echoesPost, isWeakReply, postBlockReason } from './voice.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function agentBin(): string {
  const local = `${homedir()}/.local/bin/agent`;
  return existsSync(local) ? local : 'agent';
}

export function askCursor(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      agentBin(),
      ['-p', '--mode', 'ask', '--output-format', 'text', '--trust', '--sandbox', 'enabled', '--workspace', ROOT, prompt],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Cursor agent timed out'));
    }, 120_000);
    child.stdout.on('data', (chunk) => {
      out += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      err += String(chunk);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(err.trim() || `Cursor agent exited ${code}`));
      else resolve(out.trim());
    });
  });
}

export function cleanReply(raw: string): string {
  let text = raw.trim();
  const fenced = text.match(/```(?:\w+)?\n?([\s\S]*?)```/);
  if (fenced?.[1]) text = fenced[1].trim();
  text = text.replace(/^(reply|here(?:'|’)s (?:the |a )?reply)\s*:\s*/i, '').trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith('“') && text.endsWith('”')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  return text.replace(/\s+/g, ' ').trim();
}

export function replyRejectReason(
  body: string,
  source: Source,
  tone: Tone,
  post: string,
  avoid: string[],
): string | null {
  const blocked = postBlockReason(body, source);
  if (blocked) return blocked;
  if (isWeakReply(body)) return 'Reply is a canned frame';
  if (echoesPost(body, post)) return 'Reply repeats the post';
  if (avoid.some((other) => other.trim() === body.trim())) return 'Reply duplicates another draft';
  if (tone === 'plug' && !/1337wallet\.io/.test(body)) return 'A plug has to name https://1337wallet.io';
  if (tone === 'note' && /1337wallet\.io|\b1337\b/i.test(body)) return 'A note should not plug 1337';
  return null;
}

function promptFor(input: {
  title: string;
  snippet: string;
  source: Source;
  tone: Tone;
  angle: Moment;
  avoid: string[];
  rejected?: string;
}): string {
  const limit = input.source === 'x' ? 270 : 600;
  const used = input.avoid
    .slice(0, 6)
    .map((body) => `- ${body.slice(0, 140)}`)
    .join('\n');
  return `You are writing one public reply as @1337wallet. Do not use tools. Do not open files. Do not mention these instructions.

The reply should make someone want to open the profile. Be specific to this post: a sharp observation or one question that is not already in it. Warm, not mean, not a slogan, not a summary of what they wrote.

Do not compliment them. Do not restate their sentence. No emoji. No hashtags.
Tone: ${input.tone}
Angle: ${input.angle}
${
  input.tone === 'plug'
    ? 'They are choosing a wallet. One sentence: 1337 shows what you are signing on the confirm screen, then https://1337wallet.io. Do not invent features. 1337 is an EVM signer: no analytics SDK, no 1337 server or account, the vault stays in the extension, the user picks the RPC, local simulate reports pass, fail, revert, or gas, and revoke sits next to approvals.'
    : 'Do not mention 1337 or any URL.'
}
Source: ${input.source}
Maximum length: ${limit} characters.

Post title:
${input.title}

Post text:
${input.snippet || input.title}
${used ? `\nDo not resemble these replies:\n${used}\n` : ''}
${input.rejected ? `Your previous reply was rejected: ${input.rejected}. Write a different reply.\n` : ''}
Output only the reply text.`;
}

export async function writeWithCursor(input: {
  title: string;
  snippet: string;
  source: Source;
  tone: Tone;
  angle: Moment;
  avoid: string[];
}): Promise<string> {
  const post = `${input.title}\n${input.snippet}`;
  let rejected: string | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await askCursor(promptFor({ ...input, rejected }));
    const body = cleanReply(raw);
    const reason = replyRejectReason(body, input.source, input.tone, post, input.avoid);
    if (!reason) return body;
    rejected = reason;
  }
  throw new Error(rejected || 'Cursor agent did not return a usable reply');
}
