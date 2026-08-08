import { shortAddress, type WalletAccount } from '../lib/accounts';
import { accountLabelWithEns } from '../lib/ens';
import { useEnsName } from '../lib/useEnsName';

export function AccountLabel({
  account,
  fallback,
  className,
}: {
  account: Pick<WalletAccount, 'label' | 'address'>;
  fallback?: string;
  className?: string;
}) {
  const ensName = useEnsName(account.address);
  const text =
    accountLabelWithEns(account, ensName) ||
    fallback ||
    shortAddress(account.address);

  return <span className={className}>{text}</span>;
}
