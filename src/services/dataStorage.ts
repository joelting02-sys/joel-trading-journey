// 本地数据存储服务
// 优先使用 File System Access API(Chrome/Edge 完整支持),降级到 localStorage

export type DataLocation = "filesystem" | "localStorage" | "none";

// 保存的目录句柄(File System Access API 专用)
let dirHandle: FileSystemDirectoryHandle | null = null;
// 记住的目录句柄(IndexedDB 持久化,刷新不丢)
const HANDLE_DB = "tj-data-handle";
const HANDLE_STORE = "handles";
const HANDLE_KEY = "data-dir";

// 存储位置
let currentLocation: DataLocation = "none";

const TRADES_FILE = "trades.json";
const ACCOUNTS_FILE = "accounts.json";
const SETTINGS_FILE = "settings.json";
const SOP_FILE = "sop.json";

// ============== IndexedDB 保存目录句柄 ==============

async function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, "readwrite");
    tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, "readonly");
      const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function clearDirHandle(): Promise<void> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, "readwrite");
    tx.objectStore(HANDLE_STORE).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============== 公共 API ==============

// 浏览器是否支持 File System Access API
export function isFileSystemSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

// File System Access API 类型补充( TypeScript 标准 lib 未包含)
type PermissionMode = "read" | "readwrite";
interface FSAWindow {
  showDirectoryPicker: (opts?: { mode?: PermissionMode }) => Promise<FileSystemDirectoryHandle>;
}
interface PermissionCapableHandle {
  queryPermission?: (opts: { mode: PermissionMode }) => Promise<"granted" | "prompt" | "denied">;
  requestPermission?: (opts: { mode: PermissionMode }) => Promise<"granted" | "prompt" | "denied">;
}

// 用户选择数据保存目录
export async function pickDataDirectory(): Promise<boolean> {
  if (!isFileSystemSupported()) {
    throw new Error("当前浏览器不支持,请使用 Chrome / Edge 等基于 Chromium 的浏览器");
  }
  const w = window as unknown as FSAWindow;
  const handle = await w.showDirectoryPicker({ mode: "readwrite" });
  // 验证可写
  const h = handle as unknown as PermissionCapableHandle;
  if (h.requestPermission) await h.requestPermission({ mode: "readwrite" });
  dirHandle = handle;
  await saveDirHandle(handle);
  currentLocation = "filesystem";
  return true;
}

// 启动时尝试恢复目录句柄(静默)
export async function tryRestoreDirectory(): Promise<boolean> {
  if (!isFileSystemSupported()) return false;
  const handle = await loadDirHandle();
  if (!handle) return false;
  try {
    // 验证权限,过期则提示用户重新授权
    const h = handle as unknown as PermissionCapableHandle;
    if (!h.queryPermission) return false;
    const perm = await h.queryPermission({ mode: "readwrite" });
    if (perm === "granted") {
      dirHandle = handle;
      currentLocation = "filesystem";
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// 重新请求已保存目录的权限
export async function requestDirectoryPermission(): Promise<boolean> {
  if (!isFileSystemSupported()) return false;
  const handle = await loadDirHandle();
  if (!handle) return false;
  const h = handle as unknown as PermissionCapableHandle;
  if (!h.requestPermission) return false;
  const perm = await h.requestPermission({ mode: "readwrite" });
  if (perm === "granted") {
    dirHandle = handle;
    currentLocation = "filesystem";
    return true;
  }
  return false;
}

// 取消目录绑定
export async function unbindDirectory(): Promise<void> {
  dirHandle = null;
  await clearDirHandle();
  currentLocation = "none";
}

export function getLocation(): DataLocation {
  return currentLocation;
}

// ============== 文件读写 ==============

async function writeFile(name: string, data: unknown): Promise<void> {
  if (!dirHandle) throw new Error("未选择数据目录");
  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function readFile<T>(name: string, fallback: T): Promise<T> {
  if (!dirHandle) return fallback;
  try {
    const fileHandle = await dirHandle.getFileHandle(name);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
}

// 写各模块数据
export async function saveTradesToDisk(data: unknown): Promise<void> {
  if (currentLocation === "filesystem") await writeFile(TRADES_FILE, data);
}
export async function saveAccountsToDisk(data: unknown): Promise<void> {
  if (currentLocation === "filesystem") await writeFile(ACCOUNTS_FILE, data);
}
export async function saveSettingsToDisk(data: unknown): Promise<void> {
  if (currentLocation === "filesystem") await writeFile(SETTINGS_FILE, data);
}
export async function saveSopToDisk(data: unknown): Promise<void> {
  if (currentLocation === "filesystem") await writeFile(SOP_FILE, data);
}

// 读各模块数据
export async function loadTradesFromDisk<T>(fallback: T): Promise<T> {
  return readFile(TRADES_FILE, fallback);
}
export async function loadAccountsFromDisk<T>(fallback: T): Promise<T> {
  return readFile(ACCOUNTS_FILE, fallback);
}
export async function loadSettingsFromDisk<T>(fallback: T): Promise<T> {
  return readFile(SETTINGS_FILE, fallback);
}
export async function loadSopFromDisk<T>(fallback: T): Promise<T> {
  return readFile(SOP_FILE, fallback);
}

// 获取当前绑定的目录名称
export function getDirName(): string {
  return dirHandle?.name ?? "";
}

// 列出数据目录中的所有文件（名称 + 大小 + 修改时间）
export async function listDataFiles(): Promise<Array<{ name: string; size: number; lastModified: number }>> {
  if (!dirHandle) return [];
  const files: Array<{ name: string; size: number; lastModified: number }> = [];
  const knownFiles = [TRADES_FILE, ACCOUNTS_FILE, SETTINGS_FILE, SOP_FILE];
  for (const name of knownFiles) {
    try {
      const fh = await dirHandle.getFileHandle(name);
      const file = await fh.getFile();
      files.push({ name, size: file.size, lastModified: file.lastModified });
    } catch {
      // 文件不存在则跳过
    }
  }
  return files;
}

// 读取单个数据文件内容（文本）
export async function readDataFileText(name: string): Promise<string> {
  if (!dirHandle) throw new Error("未选择数据目录");
  const fh = await dirHandle.getFileHandle(name);
  const file = await fh.getFile();
  return file.text();
}

// ============== 导出(给用户下载一份备份) ==============

export async function exportAllToFile(): Promise<void> {
  const data = {
    exportedAt: new Date().toISOString(),
    trades: JSON.parse(localStorage.getItem("tj-trade-store") ?? "{}"),
    settings: JSON.parse(localStorage.getItem("tj-settings") ?? "{}"),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `trading-journal-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
