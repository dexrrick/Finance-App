import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.finance.ledger',
  appName: 'Finance Ledger',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0b0f19'
    },
    Keyboard: {
      resize: 'body'
    }
  }
};

export default config;
