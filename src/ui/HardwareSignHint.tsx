export function HardwareSignHint({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="muted w1337-hw-sign-hint">
      Confirm each step on your device. Token swaps may ask twice — approve, then swap.
    </p>
  );
}
