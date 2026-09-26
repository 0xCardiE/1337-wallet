import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildComment, classifyThread, isReplyWorthy, postBlockReason, skipReason } from './voice.js';

describe('what we reply to', () => {
  it('suggests a note on security and transaction talk', () => {
    assert.equal(classifyThread('I hate MetaMask privacy, they track everything I do').angle, 'privacy');
    assert.equal(classifyThread('I hate MetaMask privacy, they track everything I do').tone, 'note');
    assert.equal(
      classifyThread('MetaMask default Infura RPC can see my addresses. That is the privacy leak.').angle,
      'rpc',
    );
    assert.equal(
      classifyThread("MetaMask just says Contract Interaction and I can't tell what I'm signing").angle,
      'signing',
    );
    assert.equal(
      classifyThread('About to sign this MetaMask transaction and I have no idea what the call does.').angle,
      'transaction',
    );
    assert.equal(classifyThread('Wallet security on Ethereum still feels like guessing.').angle, 'security');
  });

  it('plugs only when they are choosing a wallet', () => {
    const choosing = classifyThread('What wallet should I use for ethereum?');
    assert.equal(choosing.fit, 'reply');
    assert.equal(choosing.tone, 'plug');
    assert.equal(classifyThread('Best wallet alternative to MetaMask?').tone, 'plug');
    assert.equal(classifyThread('tired of metamask, any alternative wallet?').tone, 'plug');
  });

  it('holds bitcoin-only, seed phrases, and our own posts', () => {
    assert.equal(isReplyWorthy('What wallet should I use for bitcoin?'), false);
    assert.equal(isReplyWorthy('Lost my seed phrase, any ethereum wallet?'), false);
    assert.ok(skipReason('I lost my seed phrase, which wallet can restore it?'));
    assert.equal(isReplyWorthy('MetaMask privacy is a mess', '1337wallet'), false);
    assert.equal(isReplyWorthy('ETH is pumping hard today, chart looks insane'), false);
  });

  it('writes a different reply for each post, using their words', () => {
    const rabby = buildComment(
      {
        id: 'rabby-android',
        title: 'Rabby wallet on Android + Robinhood Chain LP tracking? Nice to see the infrastructure getting easier.',
        snippet: 'Nice to see the infrastructure getting easier to access for more folks.',
      },
      'x',
    );
    const privacy = buildComment(
      {
        id: 'privacy-future',
        title: "Agreed that's the future of crypto wallet security and privacy",
        snippet: 'wallet security and privacy',
      },
      'x',
    );
    assert.ok(rabby);
    assert.ok(privacy);
    assert.notEqual(rabby.body, privacy.body);
    assert.match(rabby.body, /Rabby|Robinhood|Android/i);
    assert.match(privacy.body, /privacy|security/i);
    assert.doesNotMatch(rabby.body, /Self-custody is not silence/);
    assert.doesNotMatch(privacy.body, /Self-custody is not silence/);
    assert.equal(postBlockReason(rabby.body, 'x'), null);
    assert.equal(privacy.body.match(/future of crypto wallet security and privacy/gi)?.length, 1);
    assert.ok(rabby.body.length <= 280);

    const plug = buildComment(
      {
        id: 'def',
        title: 'What wallet should I use for ethereum?',
        snippet: 'looking for a recommendation',
        angle: 'wallet',
        tone: 'plug',
      },
      'x',
    );
    assert.ok(plug);
    assert.equal(plug.tone, 'plug');
    assert.match(plug.body, /1337wallet\.io/);
    assert.match(plug.body, /ethereum/i);
    assert.equal(postBlockReason(plug.body, 'x'), null);
  });

  it('holds crowded posts and replies to a quiet chain share', () => {
    assert.equal(
      classifyThread('I hate MetaMask privacy, they track everything I do', undefined, { likes: 80 }).fit,
      'skip',
    );
    assert.equal(isReplyWorthy('Just bridged to Base with my wallet and it felt smooth'), true);
  });

  it('blocks ads and replies that hide who is posting', () => {
    assert.ok(postBlockReason('We build 1337. https://1337wallet.io', 'x'));
    assert.ok(
      postBlockReason(
        "I'm just a user and this random wallet is fine for privacy, analytics, and whatever else people recommend",
        'reddit',
      ),
    );
    assert.ok(postBlockReason('Check this out', 'reddit'));
  });
});