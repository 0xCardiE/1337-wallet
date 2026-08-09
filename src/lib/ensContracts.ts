import { parseAbi } from 'viem';

/** Ethereum mainnet ENS deployments (ETH Registrar Controller v2). */
export const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const;
export const ETH_BASE_REGISTRAR = '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85' as const;
export const ETH_REGISTRAR_CONTROLLER = '0x253553366da8546fc250f225fe3d25d0c782303b' as const;
export const NAME_WRAPPER = '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401' as const;
export const ENS_PUBLIC_RESOLVER = '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63' as const;

export const ENS_REGISTRY_ABI = parseAbi([
  'function resolver(bytes32 node) external view returns (address)',
  'function owner(bytes32 node) external view returns (address)',
]);

export const ETH_BASE_REGISTRAR_ABI = parseAbi([
  'function ownerOf(uint256 tokenId) external view returns (address)',
]);

export const ETH_REGISTRAR_CONTROLLER_ABI = parseAbi([
  'function commit(bytes32 commitment) external',
  'function register(string name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, bool reverseRecord, uint16 ownerControlledFuses) external payable',
  'function renew(string name, uint256 duration) external payable',
  'function makeCommitment(string name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, bool reverseRecord, uint16 ownerControlledFuses) external pure returns (bytes32)',
  'function rentPrice(string name, uint256 duration) external view returns (uint256)',
  'function available(string name) external view returns (bool)',
  'function MIN_REGISTRATION_DURATION() external view returns (uint256)',
]);

export const NAME_WRAPPER_ABI = parseAbi(['function ownerOf(uint256 id) external view returns (address)']);

export const ENS_RESOLVER_ABI = parseAbi([
  'function setContenthash(bytes32 node, bytes hash) external',
  'function contenthash(bytes32 node) external view returns (bytes)',
  'function setText(bytes32 node, string key, string value) external',
  'function text(bytes32 node, string key) external view returns (string)',
]);

export const ONE_YEAR_SECONDS = 365n * 24n * 60n * 60n;
export const COMMIT_WAIT_SECONDS = 60;
