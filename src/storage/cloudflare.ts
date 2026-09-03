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
   * Helper to normalize worker URL (supports relative / or empty for same-domain Cloudflare Pages)
   */
  private static resolveBaseUrl(workerUrl: string): string {
    const trimmed = (workerUrl || '').trim();
    if (!trimmed || trimmed === '/') {
      return '';
    }
    // If user passed just the domain or path
    return trimmed.replace(/\/+$/, '');
  }

  /**
   * Test connection to a deployed Cloudflare Worker or Cloudflare Pages Function
   */
  static async testConnection(workerUrl: string, secretKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const baseUrl = this.resolveBaseUrl(workerUrl);
      const targetUrl = `${baseUrl}/api/health`;

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'x-sync-key': secretKey,
        },
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return {
          success: false,
          message: `The URL returned a web page (HTML) instead of the Cloudflare API. If you deployed via Cloudflare Pages, push the newly added 'functions/' folder to GitHub so Cloudflare can activate your backend API automatically!`,
        };
      }

      if (!response.ok) {
        return {
          success: false,
          message: `Server returned HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const json = await response.json();
      return {
        success: true,
        message: json.message || 'Successfully connected to Cloudflare Worker & Storage!',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Connection failed: ${msg}. Make sure the Worker is deployed and accessible.`,
      };
    }
  }

  /**
   * Push local wallet state to Cloudflare Worker or Pages Function
   */
  static async pushToCloud(
    workerUrl: string,
    secretKey: string,
    accounts: Account[],
    transactions: Transaction[],
    settings: AppSettings
  ): Promise<CloudflareSyncResult> {
    try {
      const baseUrl = this.resolveBaseUrl(workerUrl);
      const targetUrl = `${baseUrl}/api/sync`;

      const payload: AppDataBackup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        generator: 'Antigravity Accounting Wallet v1.0',
        accounts,
        transactions,
        settings,
      };

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-key': secretKey,
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return {
          success: false,
          message: `Endpoint returned HTML instead of JSON. Make sure Cloudflare Pages has the 'functions/' folder deployed from GitHub.`,
        };
      }

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
        message: json.message || 'Your wallet data was successfully backed up to Cloudflare!',
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
   * Pull remote wallet state from Cloudflare Worker or Pages Function
   */
  static async pullFromCloud(
    workerUrl: string,
    secretKey: string
  ): Promise<CloudflareSyncResult> {
    try {
      const baseUrl = this.resolveBaseUrl(workerUrl);
      const targetUrl = `${baseUrl}/api/sync`;

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'x-sync-key': secretKey,
        },
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return {
          success: false,
          message: `Endpoint returned HTML instead of JSON. Ensure the 'functions/' folder is committed to GitHub and deployed on Cloudflare Pages.`,
        };
      }

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
          message: json.message || 'No existing cloud backup found. Click "Push to Cloud" first to create one!',
        };
      }

      return {
        success: true,
        message: `Successfully retrieved ${json.data.transactions.length} transactions from Cloudflare!`,
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
