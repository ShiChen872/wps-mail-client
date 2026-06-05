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

type RequestFn = <T>(path: string, init?: RequestInit) => Promise<WpsApiResponse<T>>;

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
}
