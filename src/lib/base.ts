import {
  FieldType,
  type IBase,
  type IOpenCellValue,
  type IRecordValue,
  type ITable,
} from "@lark-base-open/js-sdk";

export const ANNOTATION_TABLE_NAME = "单元格注释";
export const CELL_KEY_FIELD_NAME = "cell_key";
export const NOTE_FIELD_NAME = "note";

export type SelectedCell = {
  baseId: string;
  tableId: string;
  recordId: string;
  fieldId: string;
};

export type AnnotationEntry = {
  cellKey: string;
  note: string;
  recordId: string;
};

export type AnnotationBinding = {
  table: ITable;
  tableId: string;
  cellKeyFieldId: string;
  noteFieldId: string;
};

export function buildCellKey(cell: SelectedCell): string {
  return [cell.baseId, cell.tableId, cell.recordId, cell.fieldId].join(":");
}

export function isSingleCellSelection(
  selection: Partial<SelectedCell> | null | undefined
): selection is SelectedCell {
  return Boolean(
    selection?.baseId &&
      selection?.tableId &&
      selection?.recordId &&
      selection?.fieldId
  );
}

export function extractPlainText(value: IOpenCellValue): string {
  if (value == null) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item == null) {
          return "";
        }

        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
          return String(item);
        }

        if (typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text;
        }

        if (typeof item === "object" && "name" in item && typeof item.name === "string") {
          return item.name;
        }

        return "";
      })
      .join("");
  }

  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }

    if ("name" in value && typeof value.name === "string") {
      return value.name;
    }
  }

  return "";
}

async function ensureTextField(table: ITable, fieldName: string): Promise<string> {
  try {
    return await table.getFieldIdByName(fieldName);
  } catch {
    return table.addField({
      name: fieldName,
      type: FieldType.Text,
    });
  }
}

export async function ensureAnnotationBinding(
  base: IBase,
  createIfMissing: boolean
): Promise<AnnotationBinding | null> {
  let table: ITable | null = null;

  try {
    table = await base.getTableByName(ANNOTATION_TABLE_NAME);
  } catch {
    table = null;
  }

  if (!table) {
    if (!createIfMissing) {
      return null;
    }

    const { tableId } = await base.addTable({
      name: ANNOTATION_TABLE_NAME,
      fields: [
        {
          name: CELL_KEY_FIELD_NAME,
          type: FieldType.Text,
        },
        {
          name: NOTE_FIELD_NAME,
          type: FieldType.Text,
        },
      ],
    });
    table = await base.getTableById(tableId);
  }

  const cellKeyFieldId = await ensureTextField(table, CELL_KEY_FIELD_NAME);
  const noteFieldId = await ensureTextField(table, NOTE_FIELD_NAME);
  const meta = await table.getMeta();

  return {
    table,
    tableId: meta.id,
    cellKeyFieldId,
    noteFieldId,
  };
}

export async function loadAnnotations(
  binding: AnnotationBinding
): Promise<Map<string, AnnotationEntry>> {
  const entries = new Map<string, AnnotationEntry>();
  let pageToken: string | undefined;

  do {
    const page = await binding.table.getRecordsByPage({
      pageSize: 200,
      pageToken,
    });

    for (const record of page.records) {
      const cellKey = extractPlainText(record.fields[binding.cellKeyFieldId]);
      if (!cellKey) {
        continue;
      }

      entries.set(cellKey, {
        cellKey,
        note: extractPlainText(record.fields[binding.noteFieldId]),
        recordId: record.recordId,
      });
    }

    pageToken = page.hasMore ? page.pageToken : undefined;
  } while (pageToken);

  return entries;
}

export async function saveAnnotation(
  binding: AnnotationBinding,
  entry: AnnotationEntry | undefined,
  cell: SelectedCell,
  note: string
): Promise<void> {
  const trimmed = note.trim();
  const cellKey = buildCellKey(cell);

  if (!trimmed) {
    if (entry) {
      await binding.table.deleteRecord(entry.recordId);
    }
    return;
  }

  const recordValue: IRecordValue = {
    fields: {
      [binding.cellKeyFieldId]: cellKey,
      [binding.noteFieldId]: trimmed,
    },
  };

  if (entry) {
    await binding.table.setRecord(entry.recordId, recordValue);
    return;
  }

  await binding.table.addRecord(recordValue);
}
