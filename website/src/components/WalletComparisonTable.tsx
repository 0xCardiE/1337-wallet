export type WalletComparisonRow = {
  topic: string;
  metamask: string;
  rabby: string;
  us: string;
};

export function WalletComparisonTable({
  rows,
  emphasizeUs = false,
  caption = 'Compared with MetaMask and Rabby',
}: {
  rows: readonly WalletComparisonRow[];
  emphasizeUs?: boolean;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-[6px] border border-border/80">
      <table className="w-full min-w-[52rem] text-left text-sm" aria-label={caption}>
        <thead className="bg-bg-elevated text-text">
          <tr>
            <th className="px-4 py-3 font-medium">Topic</th>
            <th className="px-4 py-3 font-medium">MetaMask</th>
            <th className="px-4 py-3 font-medium">Rabby</th>
            <th className="px-4 py-3 font-medium">1337</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.topic} className="border-t border-border/70">
              <th className="px-4 py-3 align-top font-medium text-text">{row.topic}</th>
              <td className="px-4 py-3 align-top text-muted">{row.metamask}</td>
              <td className="px-4 py-3 align-top text-muted">{row.rabby}</td>
              <td
                className={`px-4 py-3 align-top ${emphasizeUs ? 'font-medium text-text' : 'text-muted'}`}
              >
                {row.us}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
