import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  clearDevError,
  getDevError,
  reportDevErrorFromMessage,
  subscribeDevError,
  type DevErrorMessagePayload,
  type DevErrorSection,
} from '../lib/devErrorLog';

function formatWhen(at: number): string {
  try {
    return new Date(at).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

function SectionBlock({ section }: { section: DevErrorSection }) {
  return (
    <div className="w1337-dev-error__section">
      <div className="w1337-dev-error__section-label">{section.label}</div>
      <div className={`w1337-dev-error__section-body${section.mono ? ' mono' : ''}`}>
        {section.lines.map((line, i) => (
          <div key={i} className="w1337-dev-error__line">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DevErrorPanel() {
  const entry = useSyncExternalStore(subscribeDevError, getDevError, getDevError);
  const [expanded, setExpanded] = useState(true);
  const [copyFlash, setCopyFlash] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setExpanded(true);
  }, [entry?.id]);

  useEffect(() => {
    const onMessage = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (r?: unknown) => void,
    ) => {
      const m = message as { type?: string; payload?: DevErrorMessagePayload };
      if (m?.type !== 'DEV_ERROR' || !m.payload) return;
      reportDevErrorFromMessage(m.payload);
      sendResponse({ ok: true });
      return true;
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  const copyDetail = useCallback(async () => {
    if (!entry) return;
    const blob = [
      entry.title,
      `source: ${entry.source}`,
      `at: ${new Date(entry.at).toISOString()}`,
      '',
      entry.summary,
      '',
      entry.detail,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(blob);
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 1500);
    } catch {
      /* ignore */
    }
  }, [entry]);

  if (!entry) return null;

  return (
    <div className="w1337-dev-error" role="alert" aria-live="assertive">
      <div className="w1337-dev-error__head">
        <div className="w1337-dev-error__titles">
          <span className="w1337-dev-error__badge">Dev</span>
          <strong className="w1337-dev-error__title">{entry.title}</strong>
          <span className="w1337-dev-error__meta muted">
            {entry.source}
            {formatWhen(entry.at) ? ` · ${formatWhen(entry.at)}` : ''}
          </span>
        </div>
        <div className="w1337-dev-error__actions">
          <button
            type="button"
            className="w1337-dev-error__btn"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? 'Hide detail' : 'Show detail'}
          </button>
          <button type="button" className="w1337-dev-error__btn" onClick={() => void copyDetail()}>
            {copyFlash ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            className="w1337-dev-error__btn w1337-dev-error__btn--close"
            onClick={() => clearDevError()}
            aria-label="Dismiss error"
          >
            Close
          </button>
        </div>
      </div>
      <p className="w1337-dev-error__summary">{entry.summary}</p>
      {expanded ? (
        <div className="w1337-dev-error__scroll">
          <div className="w1337-dev-error__sections">
            {entry.sections.map((section, i) => (
              <SectionBlock key={`${section.label}-${i}`} section={section} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
