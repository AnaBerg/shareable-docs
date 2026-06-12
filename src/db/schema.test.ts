import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";

import * as schema from "./schema";

type TableExport = Parameters<typeof getTableColumns>[0];

function expectTableExport(name: keyof typeof schema, tableName: string) {
  const table = schema[name];

  expect(table).toBeDefined();
  expect(getTableName(table as TableExport)).toBe(tableName);

  return getTableColumns(table as TableExport);
}

function expectColumn(
  column: { name: string; notNull: boolean; primary: boolean; columnType: string },
  expected: {
    name: string;
    notNull: boolean;
    primary?: boolean;
    columnType: string;
  },
) {
  expect(column.name).toBe(expected.name);
  expect(column.notNull).toBe(expected.notNull);
  expect(column.primary).toBe(expected.primary ?? false);
  expect(column.columnType).toBe(expected.columnType);
}

describe("document schema", () => {
  it("exports documents with required columns", () => {
    const columns = expectTableExport("documents", "documents");

    expectColumn(columns.id, {
      name: "id",
      notNull: true,
      primary: true,
      columnType: "PgText",
    });
    expectColumn(columns.ownerUserId, {
      name: "owner_user_id",
      notNull: true,
      columnType: "PgText",
    });
    expectColumn(columns.name, {
      name: "name",
      notNull: true,
      columnType: "PgText",
    });
    expectColumn(columns.description, {
      name: "description",
      notNull: false,
      columnType: "PgText",
    });
    expectColumn(columns.createdAt, {
      name: "created_at",
      notNull: true,
      columnType: "PgTimestamp",
    });
    expectColumn(columns.updatedAt, {
      name: "updated_at",
      notNull: true,
      columnType: "PgTimestamp",
    });
    expectColumn(columns.deletedAt, {
      name: "deleted_at",
      notNull: false,
      columnType: "PgTimestamp",
    });
  });

  it("exports documentVersions with required columns", () => {
    const columns = expectTableExport("documentVersions", "document_versions");

    expectColumn(columns.id, {
      name: "id",
      notNull: true,
      primary: true,
      columnType: "PgText",
    });
    expectColumn(columns.documentId, {
      name: "document_id",
      notNull: true,
      columnType: "PgText",
    });
    expectColumn(columns.versionNumber, {
      name: "version_number",
      notNull: true,
      columnType: "PgInteger",
    });
    expectColumn(columns.html, {
      name: "html",
      notNull: true,
      columnType: "PgText",
    });
    expectColumn(columns.createdByUserId, {
      name: "created_by_user_id",
      notNull: true,
      columnType: "PgText",
    });
    expectColumn(columns.createdAt, {
      name: "created_at",
      notNull: true,
      columnType: "PgTimestamp",
    });
  });

  it("exports documentShares with required columns", () => {
    const columns = expectTableExport("documentShares", "document_shares");

    expectColumn(columns.id, {
      name: "id",
      notNull: true,
      primary: true,
      columnType: "PgText",
    });
    expectColumn(columns.documentId, {
      name: "document_id",
      notNull: true,
      columnType: "PgText",
    });
    expectColumn(columns.sharedWithEmail, {
      name: "shared_with_email",
      notNull: true,
      columnType: "PgText",
    });
    expectColumn(columns.sharedByUserId, {
      name: "shared_by_user_id",
      notNull: true,
      columnType: "PgText",
    });
    expectColumn(columns.createdAt, {
      name: "created_at",
      notNull: true,
      columnType: "PgTimestamp",
    });
  });
});
