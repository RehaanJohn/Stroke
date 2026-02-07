import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  arbitrum,
  arbitrumSepolia,
  sepolia,
} from 'wagmi/chains';
import { http } from 'wagmi';

// Get project ID from env, fallback to placeholder
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID 
  || process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID 
  || '69a81dd08e42b1ad43ce81fe471d0f08'; // Fallback for development

export const config = getDefaultConfig({
  appName: 'NEXUS - Cross-Chain Shorting Agent',
  projectId,
  chains: [arbitrum, arbitrumSepolia, sepolia],
  transports: {
    [arbitrum.id]: http(),
    [arbitrumSepolia.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: false, // Disable SSR to prevent localStorage errors
});
