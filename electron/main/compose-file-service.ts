import {
  canEmbedImageFile,
  imageEmbedHtmlBlock,
} from "./attachment-embed";
import {
  createCloudLinksForLocalFiles,
  type CloudLinkItem,
} from "./cloud-attachment-service";
import type { AppConfig } from "./config";
import type { SyncService } from "./sync-service";

export interface ProcessedComposeFile {
  name: string;
  kind: "embedded" | "cloud";
  html: string;
}

export interface ProcessComposeFilesResult {
  files: ProcessedComposeFile[];
  errors: { name: string; message: string }[];
  summary: string;
}

export async function processComposeFiles(
  sync: SyncService,
  config: AppConfig,
  filePaths: string[],
  getAccessToken: () => Promise<string | null>
): Promise<ProcessComposeFilesResult> {
  const embedPaths: string[] = [];
  const cloudPaths: string[] = [];

  for (const filePath of filePaths) {
    if (canEmbedImageFile(filePath)) {
      embedPaths.push(filePath);
    } else {
      cloudPaths.push(filePath);
    }
  }

  const files: ProcessedComposeFile[] = [];
  const errors: { name: string; message: string }[] = [];

  for (const filePath of embedPaths) {
    const name = filePath.split(/[/\\]/).pop() ?? filePath;
    const html = imageEmbedHtmlBlock(filePath);
    if (html) {
      files.push({ name, kind: "embedded", html });
    } else {
      cloudPaths.push(filePath);
    }
  }

  let cloudItems: CloudLinkItem[] = [];
  if (cloudPaths.length > 0) {
    const cloud = await createCloudLinksForLocalFiles(
      sync.api,
      config,
      cloudPaths,
      getAccessToken
    );
    cloudItems = cloud.items;
    errors.push(...cloud.errors);
    for (const item of cloud.items) {
      files.push({ name: item.name, kind: "cloud", html: item.html });
    }
  }

  const embeddedN = files.filter((f) => f.kind === "embedded").length;
  const cloudN = files.filter((f) => f.kind === "cloud").length;
  const parts: string[] = [];
  if (embeddedN > 0) parts.push(`${embeddedN} 张图片已嵌入正文`);
  if (cloudN > 0) parts.push(`${cloudN} 个文件已转为云文档链接`);
  if (errors.length > 0) parts.push(`${errors.length} 个失败`);

  return {
    files,
    errors,
    summary: parts.length ? parts.join("；") : "未添加文件",
  };
}
