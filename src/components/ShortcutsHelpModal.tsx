const SHORTCUTS = [
  { keys: "N", action: "新邮件" },
  { keys: "R", action: "回复" },
  { keys: "Shift+R", action: "全部回复" },
  { keys: "F", action: "转发" },
  { keys: "Delete", action: "删除" },
  { keys: "U", action: "标为未读" },
  { keys: "/", action: "聚焦搜索框" },
  { keys: "Esc", action: "关闭写信 / 收起搜索" },
];

interface Props {
  onClose: () => void;
}

export function ShortcutsHelpModal({ onClose }: Props) {
  return (
    <div className="compose-overlay" role="dialog" aria-modal="true">
      <div className="shortcuts-panel">
        <header>键盘快捷键</header>
        <p className="shortcuts-hint">
          在输入框外生效；中文输入法开启时请先切换到英文输入。
        </p>
        <table className="shortcuts-table">
          <thead>
            <tr>
              <th>按键</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map((row) => (
              <tr key={row.keys}>
                <td>
                  <kbd>{row.keys}</kbd>
                </td>
                <td>{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="compose-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
