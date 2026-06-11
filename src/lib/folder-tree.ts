import type { MailFolderItem } from "../types";

export interface FolderTreeNode {
  folder: MailFolderItem;
  children: FolderTreeNode[];
}

export interface FolderSelectOption {
  folderId: string;
  label: string;
  depth: number;
}

/** 将扁平目录列表（含 parent_folder_id）组装为树 */
export function buildFolderTree(folders: MailFolderItem[]): FolderTreeNode[] {
  const userFolders = folders.filter((f) => f.folder_type === "user_folder");
  if (userFolders.length === 0) return [];

  const byId = new Map(userFolders.map((f) => [f.folder_id, f]));
  const childMap = new Map<string, MailFolderItem[]>();

  for (const f of userFolders) {
    const parentId = f.parent_folder_id?.trim();
    const parentKey =
      parentId && byId.has(parentId) && parentId !== f.folder_id
        ? parentId
        : "";
    const list = childMap.get(parentKey);
    if (list) list.push(f);
    else childMap.set(parentKey, [f]);
  }

  const sortByName = (a: MailFolderItem, b: MailFolderItem) =>
    a.name.localeCompare(b.name, "zh-CN");

  function build(parentKey: string): FolderTreeNode[] {
    const items = childMap.get(parentKey) ?? [];
    return items.sort(sortByName).map((folder) => ({
      folder,
      children: build(folder.folder_id),
    }));
  }

  return build("");
}

export function flattenFolderTreeForSelect(
  nodes: FolderTreeNode[],
  depth = 0
): FolderSelectOption[] {
  const out: FolderSelectOption[] = [];
  for (const node of nodes) {
    out.push({
      folderId: node.folder.folder_id,
      label: node.folder.name,
      depth,
    });
    out.push(...flattenFolderTreeForSelect(node.children, depth + 1));
  }
  return out;
}

/** 从根到目标文件夹的祖先 folder_id（不含自身），用于自动展开 */
export function folderAncestorIds(
  folders: MailFolderItem[],
  targetFolderId: string
): string[] {
  const byId = new Map(folders.map((f) => [f.folder_id, f]));
  const ancestors: string[] = [];
  let current = byId.get(targetFolderId);
  const seen = new Set<string>();

  while (current?.parent_folder_id) {
    const parentId = current.parent_folder_id.trim();
    if (!parentId || seen.has(parentId)) break;
    seen.add(parentId);
    if (byId.has(parentId)) {
      ancestors.unshift(parentId);
      current = byId.get(parentId);
    } else {
      break;
    }
  }

  return ancestors;
}

export function folderHasChildren(
  folders: MailFolderItem[],
  folderId: string
): boolean {
  return folders.some(
    (f) =>
      f.folder_type === "user_folder" &&
      f.parent_folder_id?.trim() === folderId
  );
}
