import type { SchemaTableDoc } from "@database/operations/describe/index";
import { SCHEMA_ENUMS, SCHEMA_OVERVIEW, SCHEMA_TABLES } from "@database/operations/describe/index";
import type { DatabaseSchemaDescription } from "@database/operations/readonly/types";
import { getTableColumns, getTableName, type Table } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";

function describeTable(
  table: Table,
  doc: SchemaTableDoc
): DatabaseSchemaDescription["tables"][number] {
  const name = getTableName(table);
  const omitted = new Set((doc.omittedColumns ?? []).map((column) => column.name));
  const notes = [...(doc.notes ?? [])];

  for (const [column, values] of Object.entries(doc.columnEnums ?? {})) {
    notes.push(`${column} enum: ${values.join(", ")}`);
  }

  for (const column of doc.omittedColumns ?? []) {
    notes.push(`${column.name}: ${column.reason}`);
  }

  const columns = Object.values(getTableColumns(table)).flatMap((column) => {
    if (omitted.has(column.name)) {
      return [];
    }

    const jsonShape = doc.jsonShapes?.[column.name];
    return [
      {
        name: column.name,
        type: column.getSQLType(),
        nullable: !column.notNull,
        ...(column.primary ? { primaryKey: true } : {}),
        ...(jsonShape ? { jsonShape } : {}),
      },
    ];
  });

  const foreignKeys: DatabaseSchemaDescription["tables"][number]["foreignKeys"] = [];
  try {
    const config = getTableConfig(table);
    for (const foreignKey of config.foreignKeys) {
      const reference = foreignKey.reference();
      foreignKeys.push({
        columns: reference.columns.map((column) => column.name),
        referencedTable: getTableName(reference.foreignTable),
        referencedColumns: reference.foreignColumns.map((column) => column.name),
      });
    }
  } catch {
    // Some table builders do not expose foreign-key metadata.
  }

  return {
    name,
    summary: doc.summary,
    columns,
    foreignKeys,
    ...(notes.length > 0 ? { notes } : {}),
  };
}

export function describeDatabaseSchema(): DatabaseSchemaDescription {
  return {
    overview: SCHEMA_OVERVIEW,
    tables: SCHEMA_TABLES.map(({ table, doc }) => describeTable(table, doc)),
    enums: SCHEMA_ENUMS.map((pgEnum) => ({
      name: pgEnum.enumName,
      values: [...pgEnum.enumValues],
    })),
  };
}
