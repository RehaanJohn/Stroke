import {
  arbitrum,
  arbitrumSepolia,
  sepolia,
} from 'wagmi/chains';
import { http, createConfig, createStorage, cookieStorage } from 'wagmi';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  walletConnectWallet,
  rainbowWallet
} from '@rainbow-me/rainbowkit/wallets';

// Get project ID from env, fallback to placeholder
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID
  || process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
  || '69a81dd08e42b1ad43ce81fe471d0f08';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [rainbowWallet, metaMaskWallet, walletConnectWallet],
    },
  ],
  {
    appName: 'NEXUS - Cross-Chain Shorting Agent',
    projectId,
  }
);

// Get RPC URLs from env, fallback to public ones
const arbitrumRpc = process.env.NEXT_PUBLIC_ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc';
const arbitrumSepoliaRpc = process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc';
const sepoliaRpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://eth-sepolia.public.blastapi.io';

export const config = createConfig({
  connectors,
  chains: [arbitrum, arbitrumSepolia, sepolia],
  transports: {
    [arbitrum.id]: http(arbitrumRpc),
    [arbitrumSepolia.id]: http(arbitrumSepoliaRpc),
    [sepolia.id]: http(sepoliaRpc),
  },
  ssr: true,
  storage: createStorage({
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  }),
});
