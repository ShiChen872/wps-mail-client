import type { FolderTreeNode } from "../lib/folder-tree";
import { folderHasChildren } from "../lib/folder-tree";
import type { MailFolderItem } from "../types";

interface Props {
  nodes: FolderTreeNode[];
  allFolders: MailFolderItem[];
  activeFolderId: string;
  searchMode: boolean;
  expandedIds: Set<string>;
  folderBadge: (id: string) => string;
  onToggleExpand: (folderId: string) => void;
  onSelect: (folderId: string) => void;
  depth?: number;
}

function TreeRow({
  node,
  allFolders,
  activeFolderId,
  searchMode,
  expandedIds,
  folderBadge,
  onToggleExpand,
  onSelect,
  depth,
}: {
  node: FolderTreeNode;
  allFolders: MailFolderItem[];
  activeFolderId: string;
  searchMode: boolean;
  expandedIds: Set<string>;
  folderBadge: (id: string) => string;
  onToggleExpand: (folderId: string) => void;
  onSelect: (folderId: string) => void;
  depth: number;
}) {
  const { folder_id: id, name } = node.folder;
  const hasChildren =
    node.children.length > 0 || folderHasChildren(allFolders, id);
  const expanded = expandedIds.has(id);
  const active = activeFolderId === id && !searchMode;

  return (
    <div className="folder-tree-node">
      <div
        className={`folder-tree-row ${active ? "active" : ""}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="folder-tree-expand"
            aria-expanded={expanded}
            aria-label={expanded ? "折叠" : "展开"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(id);
            }}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="folder-tree-expand folder-tree-expand-spacer" />
        )}
        <button
          type="button"
          className="folder-tree-label"
          onClick={() => onSelect(id)}
        >
          <span className="folder-tree-name">{name}</span>
          {folderBadge(id)}
        </button>
      </div>
      {expanded &&
        node.children.map((child) => (
          <TreeRow
            key={child.folder.folder_id}
            node={child}
            allFolders={allFolders}
            activeFolderId={activeFolderId}
            searchMode={searchMode}
            expandedIds={expandedIds}
            folderBadge={folderBadge}
            onToggleExpand={onToggleExpand}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

export function FolderTreeNav({
  nodes,
  allFolders,
  activeFolderId,
  searchMode,
  expandedIds,
  folderBadge,
  onToggleExpand,
  onSelect,
  depth = 0,
}: Props) {
  if (nodes.length === 0) {
    return (
      <p className="folder-tree-empty">暂无自定义文件夹</p>
    );
  }

  return (
    <div className="folder-tree">
      {nodes.map((node) => (
        <TreeRow
          key={node.folder.folder_id}
          node={node}
          allFolders={allFolders}
          activeFolderId={activeFolderId}
          searchMode={searchMode}
          expandedIds={expandedIds}
          folderBadge={folderBadge}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
          depth={depth}
        />
      ))}
    </div>
  );
}
