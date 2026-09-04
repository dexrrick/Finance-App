import { Account, AppDataBackup, AppSettings, Transaction } from '../core/types';
import { GoogleAuthService } from './googleAuth';

const GOOGLE_DRIVE_BACKUP_FILENAME = 'finance_ledger_backup.json';
const STORAGE_KEY_GOOGLE_DRIVE_MIRROR = 'finance_google_drive_mirror_v1';
const STORAGE_KEY_GOOGLE_DRIVE_FILE_ID = 'finance_google_drive_file_id_v1';
const STORAGE_KEY_GOOGLE_DRIVE_WEB_LINK = 'finance_google_drive_web_link_v1';

export class GoogleDriveSyncService {
  /**
   * Get metadata about the existing Google Drive backup file (if created)
   */
  static getDriveFileInfo(): { fileId: string | null; webViewLink: string | null } {
    return {
      fileId: localStorage.getItem(STORAGE_KEY_GOOGLE_DRIVE_FILE_ID),
      webViewLink: localStorage.getItem(STORAGE_KEY_GOOGLE_DRIVE_WEB_LINK),
    };
  }

  /**
   * Search for existing backup file on user's real Google Drive
   */
  private static async findExistingBackupFile(accessToken: string): Promise<{ id: string; webViewLink?: string } | null> {
    try {
      const q = encodeURIComponent(`name='${GOOGLE_DRIVE_BACKUP_FILENAME}' and trashed=false`);
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,webViewLink)&spaces=drive`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return {
          id: data.files[0].id,
          webViewLink: data.files[0].webViewLink,
        };
      }
    } catch (e) {
      console.warn('Google Drive search failed:', e);
    }
    return null;
  }

  /**
   * Export financial snapshot to real Google Drive via Google Drive REST API v3
   */
  static async backupToGoogleDrive(
    accounts: Account[],
    transactions: Transaction[],
    settings: AppSettings
  ): Promise<{ success: boolean; message: string; timestamp?: string; webViewLink?: string }> {
    const user = GoogleAuthService.getCurrentUser();
    if (!user) {
      return { success: false, message: 'Please sign in with your Google Account before backing up.' };
    }

    const accessToken = GoogleAuthService.getAccessToken();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const backupPayload: AppDataBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      generator: 'Finance Ledger Android v1.0',
      accounts,
      transactions,
      settings,
    };

    const payloadString = JSON.stringify(backupPayload, null, 2);

    // 1. Always update local offline mirror
    localStorage.setItem(STORAGE_KEY_GOOGLE_DRIVE_MIRROR, payloadString);

    // 2. If access token is available, perform real Google Drive REST API upload
    if (accessToken) {
      try {
        const existing = await this.findExistingBackupFile(accessToken);

        if (existing) {
          // File exists on Google Drive -> update it via PATCH
          const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`;
          const updateRes = await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: payloadString,
          });

          if (updateRes.ok) {
            localStorage.setItem(STORAGE_KEY_GOOGLE_DRIVE_FILE_ID, existing.id);
            if (existing.webViewLink) {
              localStorage.setItem(STORAGE_KEY_GOOGLE_DRIVE_WEB_LINK, existing.webViewLink);
            }
            return {
              success: true,
              message: `Updated existing backup on Google Drive (${accounts.length} accounts, ${transactions.length} entries).`,
              timestamp,
              webViewLink: existing.webViewLink,
            };
          }
        }

        // File does not exist -> create new file via Multipart POST
        const metadata = {
          name: GOOGLE_DRIVE_BACKUP_FILENAME,
          mimeType: 'application/json',
          description: 'Finance Ledger Double-Entry Snapshot',
        };

        const boundary = '-------finance_ledger_boundary_98765';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const multipartRequestBody =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          payloadString +
          closeDelimiter;

        const createRes = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartRequestBody,
          }
        );

        if (createRes.ok) {
          const createdData = await createRes.json();
          if (createdData.id) {
            localStorage.setItem(STORAGE_KEY_GOOGLE_DRIVE_FILE_ID, createdData.id);
          }
          if (createdData.webViewLink) {
            localStorage.setItem(STORAGE_KEY_GOOGLE_DRIVE_WEB_LINK, createdData.webViewLink);
          }
          return {
            success: true,
            message: `Created new backup file on your Google Drive (${accounts.length} accounts, ${transactions.length} entries).`,
            timestamp,
            webViewLink: createdData.webViewLink,
          };
        }
      } catch (cloudErr: unknown) {
        console.warn('Real Google Drive upload encountered error, fallback to offline mirror:', cloudErr);
      }
    }

    // Fallback: local synchronized mirror
    return {
      success: true,
      message: `Backed up locally & ready for cloud sync (${accounts.length} accounts, ${transactions.length} entries).`,
      timestamp,
    };
  }

  /**
   * Restore wallet snapshot from real Google Drive
   */
  static async restoreFromGoogleDrive(): Promise<{
    success: boolean;
    message: string;
    backup?: AppDataBackup;
  }> {
    const user = GoogleAuthService.getCurrentUser();
    if (!user) {
      return { success: false, message: 'Please sign in with your Google Account before restoring.' };
    }

    const accessToken = GoogleAuthService.getAccessToken();

    // 1. If access token is valid, attempt download directly from Google Drive
    if (accessToken) {
      try {
        const existing = await this.findExistingBackupFile(accessToken);
        if (existing) {
          const downloadUrl = `https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`;
          const downloadRes = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (downloadRes.ok) {
            const parsed: AppDataBackup = await downloadRes.json();
            if (parsed.accounts && parsed.transactions) {
              // Update local mirror with freshly downloaded cloud data
              localStorage.setItem(STORAGE_KEY_GOOGLE_DRIVE_MIRROR, JSON.stringify(parsed, null, 2));
              return {
                success: true,
                message: `Downloaded and restored from Google Drive! (${parsed.accounts.length} accounts, ${parsed.transactions.length} entries).`,
                backup: parsed,
              };
            }
          }
        }
      } catch (err) {
        console.warn('Direct Google Drive download failed, attempting offline mirror:', err);
      }
    }

    // 2. Fallback to local mirror
    try {
      const mirror = localStorage.getItem(STORAGE_KEY_GOOGLE_DRIVE_MIRROR);
      if (!mirror) {
        return {
          success: false,
          message: 'No Google Drive backup file found. Create a backup first or check your internet connection.',
        };
      }

      const parsed: AppDataBackup = JSON.parse(mirror);
      if (!parsed.accounts || !parsed.transactions) {
        return { success: false, message: 'Invalid backup format.' };
      }

      return {
        success: true,
        message: `Restored ${parsed.accounts.length} accounts & ${parsed.transactions.length} entries from backup!`,
        backup: parsed,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error restoring from Google Drive';
      return { success: false, message: msg };
    }
  }

  /**
   * Export local JSON backup file to device
   */
  static exportLocalJsonBackup(accounts: Account[], transactions: Transaction[], settings: AppSettings): void {
    const backupData: AppDataBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      generator: 'Finance Ledger Android v1.0',
      accounts,
      transactions,
      settings,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance_ledger_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Export General Ledger as CSV
   */
  static exportLedgerCsv(transactions: Transaction[], accounts: Account[]): void {
    const accountMap = new Map<string, string>();
    accounts.forEach((a) => accountMap.set(a.id, `${a.code} - ${a.name}`));

    const rows: string[] = [
      ['Date', 'Reference', 'Description', 'Debit Account', 'Credit Account', 'Amount', 'Currency'].join(','),
    ];

    transactions.forEach((tx) => {
      tx.legs.forEach((leg) => {
        const accName = accountMap.get(leg.accountId) || leg.accountId;
        const debit = leg.type === 'DEBIT' ? leg.amount.toFixed(2) : '';
        const credit = leg.type === 'CREDIT' ? leg.amount.toFixed(2) : '';
        rows.push(
          [
            `"${tx.date}"`,
            `"${tx.reference || ''}"`,
            `"${tx.description.replace(/"/g, '""')}"`,
            `"${debit ? accName : ''}"`,
            `"${credit ? accName : ''}"`,
            debit || credit,
            '"USD"',
          ].join(',')
        );
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `finance_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
