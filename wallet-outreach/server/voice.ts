import type { Moment, OutreachQuery, Source, Tone } from './types.js';

/**
 * Watch wallet talk, wallet security, and transactions.
 * A plug names 1337 when they are choosing a wallet. Otherwise the reply is just the useful point.
 */
export const QUERIES: OutreachQuery[] = [
  {
    id: 'wallets',
    label: 'Wallet talk with an audience',
    seeds: ['my wallet ethereum', 'switched to rabby', 'using metamask'],
    subs: ['ethereum', 'ethfinance', 'CryptoCurrency'],
    xQuery:
      '("my wallet" OR "switched to" OR Rabby OR MetaMask OR "browser wallet") (ethereum OR base OR arbitrum OR wallet) lang:en -is:retweet min_faves:2',
  },
  {
    id: 'chains',
    label: 'Chain talk with an audience',
    seeds: ['bridged to base', 'on arbitrum wallet', 'wallet on optimism'],
    subs: ['ethereum', 'defi', 'CryptoCurrency'],
    xQuery:
      '("on base" OR "on arbitrum" OR "on optimism" OR "just bridged" OR "I built") (wallet OR ethereum OR defi) lang:en -is:retweet min_faves:2',
  },
  {
    id: 'security',
    label: 'Wallet security with an audience',
    seeds: ['wallet security', 'token approval', 'what am I signing'],
    subs: ['ethereum', 'defi', 'CryptoCurrency'],
    xQuery:
      '(wallet OR MetaMask OR Rabby) (approval OR "what am I signing" OR phishing OR revoke OR "wallet security") lang:en -is:retweet min_faves:2',
  },
];

/** Canned lines that must never be reused across posts. */
const TEMPLATE_MARK =
  /Self-custody is not silence|The default RPC is who sees your addresses|Contract Interaction is not a review|Unlimited is not a payment|The test of a wallet is the confirm screen|Wallet security is the request in front of you|Before that transaction is signed|Two pipes leak/;

const NOTE_FRAMES = [
  (detail: string) => `${detail}. That's a specific thing to share.`,
  (detail: string) => `Appreciate this. ${detail}.`,
  (detail: string) => `${detail}. You can tell this is from actually using it.`,
  (detail: string) => `Good note. ${detail}.`,
  (detail: string) => `${detail}. Not enough people write the actual setup.`,
];

const HARD_SKIP: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(seed|recovery) phrases?\b/i, reason: 'Seed or recovery phrase — do not reply' },
  { pattern: /\bseed\b/i, reason: 'Seed or backup thread — do not reply' },
  { pattern: /\bprivate key\b/i, reason: 'Private key thread — do not reply' },
  { pattern: /\bmnemonic\b/i, reason: 'Mnemonic thread — do not reply' },
  { pattern: /\b(12|24)[ -]?words\b/i, reason: 'Seed-word thread — do not reply' },
  { pattern: /giveaway/i, reason: 'Giveaway' },
  { pattern: /airdrop/i, reason: 'Airdrop bait' },
  { pattern: /double your/i, reason: 'Scam pitch' },
  { pattern: /\bdm me\b/i, reason: 'DM solicitation' },
  { pattern: /recover(?:y)? (?:service|expert|fund)/i, reason: 'Recovery scam' },
  { pattern: /i('ll| will) recover/i, reason: 'Recovery offer' },
  { pattern: /\b(whatsapp|sign up bonus|our expert team|here is the trick|i made \$|casino)\b/i, reason: 'Promo, not a conversation' },
  { pattern: /\b(they took|got hacked|got drained|lost all my|stolen)\b/i, reason: 'Someone lost funds — a compliment is the wrong reply' },
  {
    pattern:
      /\b(redefine|the future of|the only way to|on-demand|don't miss|introducing|whitelist|presale|resource model|is building the fix|start at execution|update on the)\b|👇|🧵/i,
    reason: 'Promo or bot voice',
  },
];

const NAMED =
  /\b(metamask|meta mask|rabby|rainbow|coinbase wallet|frame wallet|zerion|brave wallet|ledger|trezor)\b/i;
const WALLET = /\b(wallets?|signer|self-custody|self custody|hot wallet|browser wallet)\b/i;
const EVM = /\b(ethereum|\beth\b|evm|dapp|erc-?20|defi|uniswap|arbitrum|optimism|\bbase\b)\b/i;
const BITCOIN = /\b(bitcoin|\bbtc\b|lightning|coldcard|electrum|sparrow)\b/i;
const CRYPTO =
  /\b(crypto|ethereum|metamask|rabby|rainbow|ledger|trezor|ellipal|defi|on-?chain|web3|nft|dapp|blockchain|\brpc\b|self-custody|self custody|approvals?|revoke|allowance|drainer|phishing|solana)\b/i;
const CHAIN =
  /\b(base|arbitrum|optimism|polygon|zksync|linea|scroll|avalanche|bnb|mantle|solana|sui|aptos|robinhood chain|blast|zora|monad|chain)\b/i;
const PERSONAL =
  /\b(i |i'm |im |i've |my |we |just |tried |trying |using |built |shipped |love |loving |finally |switched |minted |bridged|nice to|agreed|glad)\b/i;
const PRICE = /\b(price|chart|pump|dump|\bath\b|market cap)\b/i;
const CONCRETE =
  /\b(wallet|chain|rabby|metamask|base|arbitrum|optimism|ethereum|solana|lp|tracking|privacy|security|swap|bridge|nft|defi|rpc|approval|sign|android|polygon)\b/i;
const SECURITY =
  /\b(security|phish|scam|drainer|malicious|approvals?|revoke|permission|blind sign|simulate|hacked|compromised|signing)\b/i;
const TX = /\b(transactions?|\btx\b|sign(?:ing|ed)?|gas|swap|contract interaction|typed data|permit)\b/i;
const ASKING =
  /\b(what wallet|which wallet|best wallet|recommend|alternative|looking for|should i (?:use|switch|get)|any (?:good )?wallet|what do you use|wallet that (?:doesn'?t|won't|will not) track)\b/i;

const MOMENT_TESTS: Array<{ id: Moment; test: (text: string) => boolean }> = [
  {
    id: 'rpc',
    test: (text) =>
      (NAMED.test(text) || WALLET.test(text)) &&
      /\b(infura|default rpc|their rpc|vendor rpc|rpc endpoint)\b/i.test(text),
  },
  {
    id: 'signing',
    test: (text) =>
      /\b(blind sign|what am i signing|can'?t (?:read|tell|see) what|cannot (?:read|tell|see) what|unreadable|contract interaction|hex blob)\b/i.test(
        text,
      ),
  },
  {
    id: 'approvals',
    test: (text) =>
      /\b(unlimited approval|infinite approval|setapprovalforall|can'?t revoke|cannot revoke|token approval)\b/i.test(
        text,
      ),
  },
  {
    id: 'account',
    test: (text) =>
      (NAMED.test(text) || WALLET.test(text)) &&
      /\b(email|sign up|signup|create an account|forced account|kyc|phone number)\b/i.test(text),
  },
  {
    id: 'privacy',
    test: (text) =>
      (NAMED.test(text) || WALLET.test(text)) &&
      /\b(privacy|tracking|telemetry|analytics|phones home|spying|tracks|collects (?:my |your )?data)\b/i.test(text),
  },
  {
    id: 'transaction',
    test: (text) => TX.test(text) && (NAMED.test(text) || WALLET.test(text)),
  },
  {
    id: 'security',
    test: (text) => SECURITY.test(text) && (NAMED.test(text) || WALLET.test(text) || EVM.test(text)),
  },
  {
    id: 'wallet',
    test: (text) => NAMED.test(text) || WALLET.test(text),
  },
  {
    id: 'share',
    test: (text) => (CHAIN.test(text) || CRYPTO.test(text)) && PERSONAL.test(text),
  },
];

const PITCH =
  /\b(check (?:it |this )?out|try (?:our|1337)|download 1337|use 1337|switch to 1337|link in bio|we just launched|sign up at|we build 1337)\b/i;

export function skipReason(text: string): string | null {
  for (const rule of HARD_SKIP) {
    if (rule.pattern.test(text)) return rule.reason;
  }
  const letters = text.replace(/[^A-Za-z]/g, '');
  const capitals = letters.replace(/[^A-Z]/g, '');
  const head = letters.slice(0, 48);
  const headCaps = head.replace(/[^A-Z]/g, '');
  if (letters.length >= 40 && capitals.length / letters.length >= 0.55) return 'All-caps blast';
  if (head.length >= 24 && headCaps.length / head.length >= 0.8) return 'All-caps blast';
  if ((text.match(/#\w+/g) ?? []).length >= 4) return 'Hashtag blast';
  return null;
}

export function toneFor(text: string): Tone {
  return ASKING.test(text) ? 'plug' : 'note';
}

/** A measured zero is usually a bot. Unknown counts are left alone. A real audience can be large. */
export function attentionSkip(likes?: number, comments?: number): string | null {
  if (likes == null && comments == null) return null;
  if ((likes ?? 0) + (comments ?? 0) < 2) return 'No audience yet — usually a bot or an empty post';
  return null;
}

export function classifyThread(
  text: string,
  author?: string,
  engagement?: { likes?: number; comments?: number },
): {
  fit: 'reply' | 'skip';
  skipReason?: string;
  angle?: Moment;
  tone?: Tone;
} {
  const handle = author?.replace(/^@/, '') ?? '';
  if (/^1337wallet$/i.test(handle)) {
    return { fit: 'skip', skipReason: 'Our own post' };
  }
  const blocked = skipReason(text);
  if (blocked) return { fit: 'skip', skipReason: blocked };
  const crowded = attentionSkip(engagement?.likes, engagement?.comments);
  if (crowded) return { fit: 'skip', skipReason: crowded };
  if (BITCOIN.test(text) && !EVM.test(text) && !/\b(metamask|meta mask|rabby|rainbow)\b/i.test(text)) {
    return { fit: 'skip', skipReason: 'Bitcoin-only — 1337 is an EVM signer' };
  }
  if (PRICE.test(text) && !WALLET.test(text) && !NAMED.test(text) && !SECURITY.test(text)) {
    return { fit: 'skip', skipReason: 'Price talk' };
  }
  if (!CRYPTO.test(text) && !NAMED.test(text) && !CHAIN.test(text)) {
    return { fit: 'skip', skipReason: 'Not crypto, a chain, or a wallet' };
  }
  if (!postDetail(text)) {
    return { fit: 'skip', skipReason: 'Nothing specific in the post to answer' };
  }
  const moment = MOMENT_TESTS.find((item) => item.test(text));
  if (!moment) {
    return { fit: 'skip', skipReason: 'Not about a wallet, a chain, or something they shared' };
  }
  return { fit: 'reply', angle: moment.id, tone: toneFor(text) };
}

export function isReplyWorthy(text: string, author?: string): boolean {
  return classifyThread(text, author).fit === 'reply';
}

export function pickAngle(text: string, author?: string): Moment | undefined {
  return classifyThread(text, author).angle;
}

function hash(seed: string): number {
  let value = 0;
  for (const char of seed) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim().replace(/[.?!]+$/, '');
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > 40 ? cut.slice(0, space) : cut).replace(/[,:;]+$/, '');
}

function cleanLine(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/@(\w+)/g, '$1')
    .replace(/#(\w+)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** The concrete thing they said. Replies are built from this, so two posts cannot share one. */
export function postDetail(text: string): string | null {
  const pieces = text.split(/\n+/).flatMap((block) => block.split(/(?<=[.!?])\s+/));
  const sameOpening = (a: string, b: string) => {
    const n = Math.min(24, a.length, b.length);
    return n >= 16 && a.slice(0, n).toLowerCase() === b.slice(0, n).toLowerCase();
  };
  const sentences = pieces
    .map(cleanLine)
    .filter((part) => part.length >= 24 && CONCRETE.test(part))
    .filter(
      (part, index, all) =>
        !all.some(
          (other, otherIndex) =>
            otherIndex !== index &&
            other.length > part.length &&
            (other.includes(part) || sameOpening(part, other)),
        ),
    );
  const score = (part: string) => part.match(new RegExp(CONCRETE.source, 'gi'))?.length ?? 0;
  const best = sentences.sort((a, b) => score(b) - score(a) || b.length - a.length)[0];
  if (!best) return null;
  const detail = capitalize(clip(best, 150));
  return detail.length >= 24 ? detail : null;
}

export function isMessyReply(body: string): boolean {
  const compact = body.replace(/\s+/g, ' ').trim();
  for (let i = 0; i + 40 < compact.length; i += 1) {
    const slice = compact.slice(i, i + 40);
    if (compact.indexOf(slice, i + 40) !== -1) return true;
  }
  return false;
}

const WEAK_REPLY =
  /appreciate this|that'?s a specific thing to share|you can tell this is from actually using it|not enough people write the actual setup|^good note\b|self-custody is not silence/i;

export function isTemplateReply(body: string): boolean {
  return TEMPLATE_MARK.test(body);
}

export function isWeakReply(body: string): boolean {
  return isTemplateReply(body) || WEAK_REPLY.test(body);
}

const AI_TELL =
  /[—–;]|curious whether|what i(?:'|’)m curious|what i wonder|from the outside|the easy part|the interesting|it(?:'|’)s worth|here(?:'|’)s the thing|let(?:'|’)s unpack|i(?:'|’)d argue|one thing to note|that said|at its core|when it comes to|in a world|not just .{8,80} but |delve|landscape|tapestry|moreover|furthermore|ultimately|in essence|split cleanly|the real (?:test|question|issue|trap) is|the one that matters|that(?:'|’)s the gap|is the kind of|that is when|people will keep|\bdo not\b|\bcannot\b|\bwill not\b|\bit is\b/i;

/** Phrases and punctuation that read as a model, not a person typing. */
export function aiTellReason(body: string): string | null {
  if (AI_TELL.test(body)) return 'Reply sounds written by a model';
  return null;
}

/** True when the reply is mostly a slice of the post it is answering. */
export function echoesPost(body: string, source: string): boolean {
  const compact = body.replace(/\s+/g, ' ').toLowerCase();
  const hay = source.replace(/\s+/g, ' ').toLowerCase();
  for (let i = 0; i + 48 <= compact.length; i += 8) {
    if (hay.includes(compact.slice(i, i + 48))) return true;
  }
  return false;
}

function renderReply(detail: string, tone: Tone, frame: number): string {
  if (tone === 'plug') {
    const short = clip(detail, 110);
    return `${short}. If that's the wallet you want, the confirm has to say what you're signing. We ship that as 1337. https://1337wallet.io`;
  }
  return NOTE_FRAMES[frame % NOTE_FRAMES.length]!(detail);
}

export function buildComment(
  topic: { id: string; title: string; snippet: string; angle?: Moment; tone?: Tone },
  source: Source,
  avoid: string[] = [],
): { angle: Moment; tone: Tone; body: string } | null {
  const text = `${topic.title}\n${topic.snippet}`;
  const detail = postDetail(text);
  if (!detail) return null;
  const classified = classifyThread(text);
  const angle = topic.angle ?? classified.angle ?? 'share';
  const tone = topic.tone ?? classified.tone ?? 'note';
  const taken = new Set(avoid.map((body) => body.trim()));
  const start = hash(topic.id);
  for (let offset = 0; offset < NOTE_FRAMES.length; offset += 1) {
    let body = renderReply(detail, tone, start + offset).replace(/\s+/g, ' ').trim();
    if (source === 'x' && body.length > 280) body = clip(body, 277);
    if (body.length < 60 || taken.has(body) || isTemplateReply(body)) continue;
    if (postBlockReason(body, source)) continue;
    return { angle, tone, body };
  }
  return null;
}

export function postBlockReason(body: string, source: Source): string | null {
  const text = body.trim();
  if (text.length < 60) return 'Reply is too short to be useful';
  if (PITCH.test(text)) return 'Reply reads as an ad';
  if (/\b(i'm|i am) just a user\b/i.test(text) || /\bnot affiliated\b/i.test(text)) {
    return 'Reply pretends this account is an unaffiliated user';
  }
  if (/\b(seed phrase|private key|mnemonic)\b/i.test(text) && /\b(paste|send me|import your|enter your)\b/i.test(text)) {
    return 'Reply asks someone to hand over a secret';
  }
  const links = text.match(/https?:\/\/\S+/g) ?? [];
  if (links.join('').length > text.length * 0.45) return 'Reply is mostly a link';
  if (source === 'x' && text.length > 280) return `X reply is ${text.length} characters (max 280)`;
  return null;
}
