import type { Paginated, WpsApiResponse } from "./types.js";

export interface DriveItem {
  id: string;
  name: string;
  source?: string;
  allotee_type?: string;
}

export interface UploadStoreRequest {
  method: string;
  url: string;
}

export interface RequestUploadResult {
  store_request: UploadStoreRequest;
  upload_id: string;
}

export interface CommittedFile {
  id: string;
  name: string;
  drive_id: string;
  link_url?: string;
}

export interface OpenLinkResult {
  url: string;
  id: string;
  file_id: string;
  drive_id: string;
}

export type CloudFileType = "file" | "folder" | "shortcut" | "unknown";

export interface CloudFileItem {
  id: string;
  name: string;
  drive_id: string;
  type: CloudFileType;
  link_url?: string;
  parent_id?: string;
  mtime?: number;
}

type RequestFn = <T>(path: string, init?: RequestInit) => Promise<WpsApiResponse<T>>;

function asCloudFileType(value: unknown): CloudFileType {
  const t = String(value ?? "file").toLowerCase();
  if (t === "file" || t === "folder" || t === "shortcut") return t;
  return "unknown";
}

function normalizeCloudFile(raw: Record<string, unknown>): CloudFileItem | null {
  const file = (raw.file ?? raw.item ?? raw) as Record<string, unknown>;
  const id = String(file.id ?? raw.id ?? "");
  const driveId = String(file.drive_id ?? raw.drive_id ?? "");
  if (!id || !driveId) return null;
  return {
    id,
    name: String(file.name ?? file.fname ?? raw.name ?? "未命名"),
    drive_id: driveId,
    type: asCloudFileType(file.type ?? raw.type),
    link_url:
      typeof file.link_url === "string"
        ? file.link_url
        : typeof raw.link_url === "string"
          ? raw.link_url
          : undefined,
    parent_id:
      typeof file.parent_id === "string" ? file.parent_id : undefined,
    mtime:
      typeof file.mtime === "number"
        ? file.mtime
        : typeof raw.mtime === "number"
          ? raw.mtime
          : undefined,
  };
}

/** 云文档：上传 + 分享（V1.3 云文档链接附件） */
export class WpsYundocApi {
  constructor(private request: RequestFn) {}

  async listUserDrives(sources = "special", pageSize = 20) {
    const q = new URLSearchParams({
      allotee_type: "user",
      page_size: String(pageSize),
      sources,
    });
    const res = await this.request<Paginated<DriveItem>>(`/v7/drives?${q}`);
    return res.data;
  }

  async requestFileUpload(
    driveId: string,
    parentId: string,
    body: {
      name: string;
      size: number;
      hashes: { type: "md5" | "sha256"; sum: string }[];
      parent_path?: string[];
      on_name_conflict?: "rename" | "overwrite" | "fail" | "replace";
    }
  ) {
    const res = await this.request<RequestUploadResult>(
      `/v7/drives/${encodeURIComponent(driveId)}/files/${encodeURIComponent(parentId)}/request_upload`,
      { method: "POST", body: JSON.stringify(body) }
    );
    return res.data;
  }

  async commitFileUpload(
    driveId: string,
    parentId: string,
    uploadId: string
  ) {
    const res = await this.request<CommittedFile>(
      `/v7/drives/${encodeURIComponent(driveId)}/files/${encodeURIComponent(parentId)}/commit_upload`,
      {
        method: "POST",
        body: JSON.stringify({ upload_id: uploadId }),
      }
    );
    return res.data;
  }

  async openFileLink(
    driveId: string,
    fileId: string,
    body: {
      scope: "company" | "anyone" | "users";
      role_id: string;
      opts?: { expire_period?: number };
    }
  ) {
    const res = await this.request<OpenLinkResult>(
      `/v7/drives/${encodeURIComponent(driveId)}/files/${encodeURIComponent(fileId)}/open_link`,
      { method: "POST", body: JSON.stringify(body) }
    );
    return res.data;
  }

  /** 最近访问的云文档（对齐 365.kdocs.cn/latest） */
  async listLatestItems(pageSize = 30, pageToken?: string) {
    const q = new URLSearchParams({ page_size: String(pageSize) });
    if (pageToken) q.set("page_token", pageToken);
    const res = await this.request<Paginated<Record<string, unknown>>>(
      `/v7/drive_latest/items?${q}`
    );
    const items = (res.data.items ?? [])
      .map((row) => normalizeCloudFile(row))
      .filter((x): x is CloudFileItem => Boolean(x));
    return { items, next_page_token: res.data.next_page_token };
  }

  /** 文件夹子项（parent_id=0 为盘根目录） */
  async listFolderChildren(
    driveId: string,
    parentId: string,
    opts: {
      pageSize?: number;
      pageToken?: string;
      filterType?: "file" | "folder";
    } = {}
  ) {
    const q = new URLSearchParams({
      page_size: String(opts.pageSize ?? 50),
      order: "desc",
      order_by: "mtime",
    });
    if (opts.pageToken) q.set("page_token", opts.pageToken);
    if (opts.filterType) q.set("filter_type", opts.filterType);
    const res = await this.request<Paginated<Record<string, unknown>>>(
      `/v7/drives/${encodeURIComponent(driveId)}/files/${encodeURIComponent(parentId)}/children?${q}`
    );
    const items = (res.data.items ?? [])
      .map((row) => normalizeCloudFile(row))
      .filter((x): x is CloudFileItem => Boolean(x));
    return { items, next_page_token: res.data.next_page_token };
  }

  /** 按文件名搜索云文档 */
  async searchFiles(keyword: string, pageSize = 30, pageToken?: string) {
    const q = new URLSearchParams({
      keyword,
      page_size: String(pageSize),
    });
    if (pageToken) q.set("page_token", pageToken);
    const res = await this.request<Paginated<Record<string, unknown>>>(
      `/v7/files/search?${q}`
    );
    const items = (res.data.items ?? [])
      .map((row) => normalizeCloudFile(row))
      .filter((x): x is CloudFileItem => Boolean(x));
    return { items, next_page_token: res.data.next_page_token };
  }
}
