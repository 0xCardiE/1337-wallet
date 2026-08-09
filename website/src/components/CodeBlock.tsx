type CodeBlockProps = {
  title?: string;
  children: string;
};

export function CodeBlock({ title, children }: CodeBlockProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-[#0a0d0b]">
      {title ? (
        <div className="border-b border-border/70 px-4 py-2 text-xs font-medium text-muted">
          {title}
        </div>
      ) : null}
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-[#d4f5dc]">
        <code>{children.trim()}</code>
      </pre>
    </div>
  );
}
