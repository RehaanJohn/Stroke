import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  arbitrum,
  base,
  mainnet,
  optimism,
} from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'NEXUS - Cross-Chain Shorting Agent',
  projectId: 'YOUR_PROJECT_ID', // Get from WalletConnect Cloud
  chains: [
    mainnet,
    arbitrum,
    base,
    optimism,
  ],
  ssr: true,
});
