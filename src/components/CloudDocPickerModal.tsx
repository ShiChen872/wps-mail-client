import { useCallback, useEffect, useState } from "react";

export interface CloudDocItem {
  driveId: string;
  fileId: string;
  name: string;
  type: "file" | "folder" | "shortcut" | "unknown";
  linkUrl?: string;
  mtime?: number;
}

interface Props {
  onClose: () => void;
  onConfirm: (items: CloudDocItem[]) => Promise<void>;
}

type ViewMode = "latest" | "folder" | "search";

function itemKey(item: CloudDocItem): string {
  return `${item.driveId}:${item.fileId}`;
}

function fileIcon(type: CloudDocItem["type"]): string {
  if (type === "folder") return "📁";
  return "📄";
}

export function CloudDocPickerModal({ onClose, onConfirm }: Props) {
  const [mode, setMode] = useState<ViewMode>("latest");
  const [items, setItems] = useState<CloudDocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<Record<string, CloudDocItem>>({});
  const [confirming, setConfirming] = useState(false);
  const [folderStack, setFolderStack] = useState<
    { driveId: string; fileId: string; name: string }[]
  >([]);

  const loadDriveRoot = useCallback(async () => {
    setMode("folder");
    setLoading(true);
    setError(null);
    try {
      const data = await window.wpsMail.getCloudDriveRoot();
      setFolderStack([
        { driveId: data.driveId, fileId: "0", name: data.driveName || "我的云文档" },
      ]);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLatest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await window.wpsMail.listCloudLatest();
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFolder = useCallback(
    async (driveId: string, parentId: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await window.wpsMail.listCloudFolder({ driveId, parentId });
        setItems(data.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const runSearch = useCallback(async () => {
    const q = keyword.trim();
    if (!q) return;
    setMode("search");
    setLoading(true);
    setError(null);
    try {
      const data = await window.wpsMail.searchCloudDocs({ keyword: q });
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  const toggleSelect = (item: CloudDocItem) => {
    if (item.type !== "file" && item.type !== "shortcut" && item.type !== "unknown") {
      return;
    }
    const key = itemKey(item);
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = item;
      return next;
    });
  };

  const openFolder = async (item: CloudDocItem) => {
    if (item.type !== "folder") return;
    setMode("folder");
    setFolderStack((prev) => [
      ...prev,
      { driveId: item.driveId, fileId: item.fileId, name: item.name },
    ]);
    await loadFolder(item.driveId, item.fileId);
  };

  const goBackFolder = async () => {
    const next = [...folderStack];
    next.pop();
    setFolderStack(next);
    if (next.length === 0) {
      setMode("latest");
      await loadLatest();
      return;
    }
    const parent = next[next.length - 1];
    await loadFolder(parent.driveId, parent.fileId);
  };

  const handleConfirm = async () => {
    const picked = Object.values(selected);
    if (!picked.length) return;
    setConfirming(true);
    setError(null);
    try {
      await onConfirm(picked);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConfirming(false);
    }
  };

  const selectedCount = Object.keys(selected).length;

  return (
    <div className="compose-overlay cloud-picker-overlay" role="dialog" aria-modal="true">
      <div className="cloud-picker-panel">
        <header className="cloud-picker-header">
          <span>从云文档选择</span>
          <button type="button" className="btn-link" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="cloud-picker-toolbar">
          <button
            type="button"
            className={`btn ${mode === "latest" ? "btn-primary" : ""}`}
            onClick={() => {
              setMode("latest");
              setFolderStack([]);
              void loadLatest();
            }}
          >
            最近
          </button>
          <button
            type="button"
            className={`btn ${mode === "folder" && folderStack.length > 0 ? "btn-primary" : ""}`}
            onClick={() => void loadDriveRoot()}
          >
            我的云文档
          </button>
          {mode === "folder" && folderStack.length > 0 && (
            <button type="button" className="btn" onClick={() => void goBackFolder()}>
              ← 返回
            </button>
          )}
          <input
            className="cloud-picker-search"
            placeholder="搜索云文档"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runSearch();
            }}
          />
          <button type="button" className="btn" onClick={() => void runSearch()}>
            搜索
          </button>
          <button
            type="button"
            className="btn-link"
            onClick={() => void window.wpsMail.openCloudDoc()}
          >
            在浏览器打开云文档
          </button>
        </div>

        {mode === "folder" && folderStack.length > 0 && (
          <p className="cloud-picker-breadcrumb">
            {folderStack.map((f) => f.name).join(" / ")}
          </p>
        )}

        <div className="cloud-picker-list">
          {loading && <p className="cloud-picker-empty">加载中…</p>}
          {!loading && error && (
            <p className="cloud-picker-error">
              {error}
              <br />
              请确认开放平台已开通云文档权限（kso.drive / kso.file / kso.file_link）并重新登录。
            </p>
          )}
          {!loading && !error && items.length === 0 && (
            <p className="cloud-picker-empty">暂无云文档</p>
          )}
          {!loading &&
            !error &&
            items.map((item) => {
              const key = itemKey(item);
              const isFolder = item.type === "folder";
              const checked = Boolean(selected[key]);
              return (
                <div
                  key={key}
                  className={`cloud-picker-row ${checked ? "is-selected" : ""}`}
                >
                  {isFolder ? (
                    <button
                      type="button"
                      className="cloud-picker-row-main"
                      onClick={() => void openFolder(item)}
                    >
                      <span className="cloud-picker-icon">{fileIcon(item.type)}</span>
                      <span className="cloud-picker-name">{item.name}</span>
                    </button>
                  ) : (
                    <label className="cloud-picker-row-main">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(item)}
                      />
                      <span className="cloud-picker-icon">{fileIcon(item.type)}</span>
                      <span className="cloud-picker-name">{item.name}</span>
                    </label>
                  )}
                </div>
              );
            })}
        </div>

        <footer className="cloud-picker-footer">
          <span className="cloud-picker-count">
            {selectedCount > 0 ? `已选 ${selectedCount} 个文件` : "选择要插入链接的云文档"}
          </span>
          <div className="cloud-picker-actions">
            <button type="button" className="btn" onClick={onClose} disabled={confirming}>
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={selectedCount === 0 || confirming}
              onClick={() => void handleConfirm()}
            >
              {confirming ? "生成链接…" : "插入链接"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
