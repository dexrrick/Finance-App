import { Account, AppDataBackup, AppSettings, Transaction } from '../core/types';

export interface CloudflareSyncResult {
  success: boolean;
  message: string;
  data?: {
    accounts: Account[];
    transactions: Transaction[];
    settings?: AppSettings;
    lastSyncedAt?: string;
  };
}

export class CloudflareSyncClient {
  /**
   * Test connection to a deployed Cloudflare Worker
   */
  static async testConnection(workerUrl: string, secretKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const cleanUrl = workerUrl.replace(/\/+$/, '');
      const response = await fetch(`${cleanUrl}/api/health`, {
        method: 'GET',
        headers: {
          'x-sync-key': secretKey,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Server returned HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const json = await response.json();
      return {
        success: true,
        message: json.message || 'Successfully connected to Cloudflare Worker!',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Connection failed: ${msg}. Make sure CORS is enabled and URL is accessible.`,
      };
    }
  }

  /**
   * Push local wallet state to Cloudflare Worker
   */
  static async pushToCloud(
    workerUrl: string,
    secretKey: string,
    accounts: Account[],
    transactions: Transaction[],
    settings: AppSettings
  ): Promise<CloudflareSyncResult> {
    try {
      const cleanUrl = workerUrl.replace(/\/+$/, '');
      const payload: AppDataBackup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        generator: 'Antigravity Accounting Wallet v1.0',
        accounts,
        transactions,
        settings,
      };

      const response = await fetch(`${cleanUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-key': secretKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `Upload failed (HTTP ${response.status}): ${errorText}`,
        };
      }

      const json = await response.json();
      return {
        success: true,
        message: json.message || 'Data successfully backed up to Cloudflare!',
        data: {
          accounts,
          transactions,
          settings,
          lastSyncedAt: new Date().toISOString(),
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Network error while syncing: ${msg}`,
      };
    }
  }

  /**
   * Pull remote wallet state from Cloudflare Worker
   */
  static async pullFromCloud(
    workerUrl: string,
    secretKey: string
  ): Promise<CloudflareSyncResult> {
    try {
      const cleanUrl = workerUrl.replace(/\/+$/, '');
      const response = await fetch(`${cleanUrl}/api/sync`, {
        method: 'GET',
        headers: {
          'x-sync-key': secretKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `Download failed (HTTP ${response.status}): ${errorText}`,
        };
      }

      const json = await response.json();
      if (!json.data || !Array.isArray(json.data.accounts) || !Array.isArray(json.data.transactions)) {
        return {
          success: false,
          message: 'Cloudflare Worker returned invalid backup data structure.',
        };
      }

      return {
        success: true,
        message: `Successfully retrieved ${json.data.transactions.length} transactions from Cloudflare.`,
        data: {
          accounts: json.data.accounts,
          transactions: json.data.transactions,
          settings: json.data.settings,
          lastSyncedAt: json.lastSyncedAt || new Date().toISOString(),
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Network error while retrieving from cloud: ${msg}`,
      };
    }
  }
}
