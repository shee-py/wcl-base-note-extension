import { useEffect, useState } from "react";
import {
  ToastType,
  WidgetBaseEvent,
  bitable,
  type Selection,
} from "@lark-base-open/js-sdk";
import {
  ANNOTATION_TABLE_NAME,
  type AnnotationBinding,
  type AnnotationEntry,
  buildCellKey,
  ensureAnnotationBinding,
  isSingleCellSelection,
  loadAnnotations,
  saveAnnotation,
  type SelectedCell,
} from "./lib/base";

type AppPhase = "loading" | "setup" | "ready" | "error";

function selectionToCell(selection: Selection | null): SelectedCell | null {
  if (!isSingleCellSelection(selection)) {
    return null;
  }

  return {
    baseId: selection.baseId,
    tableId: selection.tableId,
    recordId: selection.recordId,
    fieldId: selection.fieldId,
  };
}

export default function App() {
  const [phase, setPhase] = useState<AppPhase>("loading");
  const [binding, setBinding] = useState<AnnotationBinding | null>(null);
  const [annotations, setAnnotations] = useState<Map<string, AnnotationEntry>>(new Map());
  const [selection, setSelection] = useState<SelectedCell | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [editable, setEditable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const currentKey = selection ? buildCellKey(selection) : "";
  const currentEntry = currentKey ? annotations.get(currentKey) : undefined;

  async function toast(message: string, toastType: ToastType = ToastType.info) {
    try {
      await bitable.ui.showToast({ message, toastType });
    } catch {
      console.info(message);
    }
  }

  async function refreshAnnotations(activeBinding: AnnotationBinding) {
    const entries = await loadAnnotations(activeBinding);
    setAnnotations(entries);
  }

  async function bootstrap(createIfMissing: boolean) {
    setBusy(true);
    setErrorMessage("");

    try {
      const baseApi = bitable.base;
      const canEdit = await baseApi.isEditable();
      setEditable(canEdit);

      const activeBinding = await ensureAnnotationBinding(baseApi, createIfMissing);
      if (!activeBinding) {
        setBinding(null);
        setAnnotations(new Map());
        setPhase("setup");
        return;
      }

      setBinding(activeBinding);
      await refreshAnnotations(activeBinding);
      setPhase("ready");
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "初始化失败");
      setPhase("error");
    } finally {
      setBusy(false);
    }
  }

  async function syncSelection(nextSelection: Selection | null) {
    const nextCell = selectionToCell(nextSelection);
    setSelection(nextCell);

    if (!nextCell) {
      setEditing(false);
      setDraft("");
      return;
    }

    const nextKey = buildCellKey(nextCell);
    const nextEntry = annotations.get(nextKey);
    setEditing(false);
    setDraft(nextEntry?.note ?? "");
  }

  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};

    async function init() {
      await bootstrap(false);

      try {
        await bitable.base.registerBaseEvent(WidgetBaseEvent.SelectionChange);
      } catch (error) {
        console.warn("Failed to register selection event", error);
      }

      unsubscribe = bitable.base.onSelectionChange((event) => {
        if (disposed) {
          return;
        }
        void syncSelection(event.data);
      });

      try {
        const currentSelection = await bitable.base.getSelection();
        if (!disposed) {
          await syncSelection(currentSelection);
        }
      } catch (error) {
        console.warn("Failed to read initial selection", error);
      }
    }

    void init();

    return () => {
      disposed = true;
      unsubscribe();
      void bitable.base.unregisterBaseEvent(WidgetBaseEvent.SelectionChange).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!selection) {
      return;
    }

    const nextEntry = annotations.get(buildCellKey(selection));
    setDraft(nextEntry?.note ?? "");
  }, [annotations, selection]);

  async function handleCreateTable() {
    await bootstrap(true);
    await toast(`已准备好 ${ANNOTATION_TABLE_NAME} 表`, ToastType.success);
  }

  async function handleRefresh() {
    if (!binding) {
      await bootstrap(false);
      return;
    }

    setBusy(true);
    try {
      await refreshAnnotations(binding);
      await toast("注释已刷新", ToastType.success);
    } catch (error) {
      console.error(error);
      await toast("刷新失败", ToastType.error);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!binding || !selection) {
      return;
    }

    if (selection.tableId === binding.tableId) {
      await toast("请在业务表中选中单元格，而不是注释表本身", ToastType.warning);
      return;
    }

    setBusy(true);
    try {
      await saveAnnotation(binding, currentEntry, selection, draft);
      await refreshAnnotations(binding);
      setEditing(false);
      await toast(draft.trim() ? "注释已保存" : "注释已删除", ToastType.success);
    } catch (error) {
      console.error(error);
      await toast("保存失败", ToastType.error);
    } finally {
      setBusy(false);
    }
  }

  function renderBody() {
    if (phase === "loading") {
      return <div className="panel compact-panel muted">正在连接 Base 并读取注释表…</div>;
    }

    if (phase === "setup") {
      return (
        <div className="panel compact-panel stack">
          <div className="muted">
            还没找到注释表。点击下面的按钮后，插件会在当前 Base 内创建一张
            <strong>“单元格注释”</strong>表，并自动补齐 `cell_key` / `note` 字段。
          </div>
          <button className="primary-button" onClick={() => void handleCreateTable()} disabled={busy}>
            创建注释表
          </button>
        </div>
      );
    }

    if (phase === "error") {
      return (
        <div className="panel compact-panel stack">
          <div className="error-text">初始化失败：{errorMessage || "未知错误"}</div>
          <button className="secondary-button" onClick={() => void bootstrap(false)} disabled={busy}>
            重试
          </button>
        </div>
      );
    }

    if (!selection) {
      return (
        <div className="panel compact-panel muted">
          请选择一个具体单元格。当前插件会在你切换选中格子时，直接显示这格的整段注释。
        </div>
      );
    }

    if (binding && selection.tableId === binding.tableId) {
      return (
        <div className="panel compact-panel muted">
          当前选中的是注释表本身。请切回业务表里的某个单元格查看或编辑注释。
        </div>
      );
    }

    return (
      <div className="stack compact-stack">
        <div className="selection-chip">当前单元格注释</div>

        {currentEntry?.note ? (
          <div className="note-bubble">{currentEntry.note}</div>
        ) : (
          <div className="empty-bubble">这格还没有注释。</div>
        )}

        <div className="editor-panel compact-editor">
          <div className="editor-head">
            <span className="editor-title">操作</span>
            <div className="action-row">
              <button
                className="pill-button"
                onClick={() => {
                  setEditing((value) => !value);
                  setDraft(currentEntry?.note ?? "");
                }}
                type="button"
              >
                {editing ? "取消" : currentEntry ? "修改" : "新增"}
              </button>
              {currentEntry ? (
                <button
                  className="pill-button subtle"
                  onClick={() => {
                    setEditing(true);
                    setDraft("");
                  }}
                  type="button"
                >
                  清空
                </button>
              ) : null}
            </div>
          </div>

          {editing ? (
            <div className="stack">
              <textarea
                className="note-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="输入这格的注释内容"
                rows={8}
              />
              <div className="button-row">
                <button
                  className="primary-button"
                  onClick={() => void handleSave()}
                  disabled={busy || !editable}
                  type="button"
                >
                  保存
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setEditing(false);
                    setDraft(currentEntry?.note ?? "");
                  }}
                  disabled={busy}
                  type="button"
                >
                  取消
                </button>
              </div>
              {!editable ? (
                <div className="muted small">当前 Base 不是编辑模式，无法保存注释。</div>
              ) : null}
            </div>
          ) : (
            <div className="muted small">默认只展示注释正文，编辑区保持收起。</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero compact-hero">
        <div className="hero-copy">
          <div className="eyebrow">WCL Base Extension</div>
          <h1>单元格注释气泡</h1>
        </div>
        <button className="secondary-button small-button" onClick={() => void handleRefresh()} disabled={busy} type="button">
          刷新
        </button>
      </section>

      {renderBody()}
    </main>
  );
}
