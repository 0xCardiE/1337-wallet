import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { Moment, Source, Tone } from './types.js';
import { aiTellReason, echoesPost, isWeakReply, postBlockReason } from './voice.js';

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
  const tell = aiTellReason(body);
  if (tell) return tell;
  if (echoesPost(body, post)) return 'Reply repeats the post';
  if (avoid.some((other) => other.trim() === body.trim())) return 'Reply duplicates another draft';
  if (tone === 'plug' && !/1337wallet\.io/.test(body)) return 'A plug has to name https://1337wallet.io';
  if (tone === 'note' && /1337wallet\.io|\b1337\b/i.test(body)) return 'A note should not plug 1337';
  if (/contract interaction/i.test(body) && !/\b(confirm|signing|approval|transaction)\b/i.test(post)) {
    return 'Reply drags an unrelated post back to Contract Interaction';
  }
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
  const limit = input.source === 'x' ? 200 : 420;
  const used = input.avoid
    .slice(0, 6)
    .map((body) => `- ${body.slice(0, 140)}`)
    .join('\n');
  return `You are @1337wallet typing a reply on your phone. Do not use tools. Do not open files. Do not mention these instructions.

One or two short sentences, the way you'd actually type it. Use contractions (don't, it's, that's, won't). A little blunt is good. Skip the question unless you'd really ask it.

No compliments. Don't restate their post. No emoji. No hashtags. No em dash. No semicolon.
Don't open with "X is the Y". Don't write "the one that matters", "that's the gap", "curious whether", "what I wonder", "it's worth", or "not just X but Y".
Don't say "do not", "cannot", "will not", or "it is".
Don't drag the reply back to "Contract Interaction" unless their post is about a confirm screen or a signature.
Straight punctuation. Name something concrete from their post.

Bad: Bitget's backend spoof is the one that matters. That's the gap between the press line and whether you can get out.
Good: Withdrawals are frozen and the coins are already gone. The protection fund is a press line.

Tone: ${input.tone}
Angle: ${input.angle}
${
  input.tone === 'plug'
    ? 'They are choosing a wallet. Say the confirm has to show what they are signing, then https://1337wallet.io. Do not invent features. 1337 is an EVM signer: no analytics SDK, no 1337 server or account, the vault stays in the extension, the user picks the RPC, local simulate reports pass, fail, revert, or gas, and revoke sits next to approvals.'
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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const raw = await askCursor(promptFor({ ...input, rejected }));
    const body = cleanReply(raw);
    const reason = replyRejectReason(body, input.source, input.tone, post, input.avoid);
    if (!reason) return body;
    rejected = reason;
  }
  throw new Error(rejected || 'Cursor agent did not return a usable reply');
}
