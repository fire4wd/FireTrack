export interface NextcloudConfig {
  enabled: boolean;
  serverUrl: string; // e.g. "https://cloud.example.com"
  username: string; // e.g. "mario"
  appPassword: string; // generated app password
  remotePath: string; // e.g. "/OnTrack" or "/Salute/OnTrack"
  fileName: string; // default: "FireTrack_Sync_Backup.json"
  autoSyncOnSave: boolean;
  lastSyncTimestamp?: number;
  lastSyncStatus?: 'success' | 'error' | 'idle';
  lastSyncMessage?: string;
}

export interface NextcloudRemoteFileInfo {
  name: string;
  lastModified?: string;
  size?: number;
  etag?: string;
}
