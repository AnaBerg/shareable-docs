import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import { PgDialect, getTableConfig } from "drizzle-orm/pg-core";

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

function expectIndex(
  table: TableExport,
  expected: { name: string; unique: boolean; columns: string[] },
) {
  const index = getTableConfig(table).indexes.find(
    (candidate) => candidate.config.name === expected.name,
  );

  expect(index?.config.unique).toBe(expected.unique);
  expect(index?.config.columns.map((column) => "name" in column ? column.name : undefined)).toEqual(
    expected.columns,
  );
}

function expectForeignKey(table: TableExport, name: string) {
  expect(
    getTableConfig(table).foreignKeys.map((foreignKey) => foreignKey.getName()),
  ).toContain(name);
}

function expectCheck(table: TableExport, name: string) {
  expect(getTableConfig(table).checks.map((check) => check.name)).toContain(name);
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
    const table = schema.documentVersions as TableExport;
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
    expectIndex(table, {
      name: "document_versions_document_id_version_unique",
      unique: true,
      columns: ["document_id", "version_number"],
    });
    expectForeignKey(table, "document_versions_document_id_documents_id_fk");
    expectForeignKey(table, "document_versions_created_by_user_id_users_id_fk");
  });

  it("exports documentShares with required columns", () => {
    const table = schema.documentShares as TableExport;
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
    expectIndex(table, {
      name: "document_shares_document_id_email_unique",
      unique: true,
      columns: ["document_id", "shared_with_email"],
    });
    expectForeignKey(table, "document_shares_document_id_documents_id_fk");
    expectForeignKey(table, "document_shares_shared_by_user_id_users_id_fk");
    expectCheck(table, "document_shares_shared_with_email_normalized_check");
  });

  it("exports documentShareLinks with required columns", () => {
    const table = schema.documentShareLinks as TableExport;
    const columns = expectTableExport(
      "documentShareLinks",
      "document_share_links",
    );

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
    expectColumn(columns.tokenHash, {
      name: "token_hash",
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
    expectColumn(columns.revokedAt, {
      name: "revoked_at",
      notNull: false,
      columnType: "PgTimestamp",
    });
    expectIndex(table, {
      name: "document_share_links_token_hash_unique",
      unique: true,
      columns: ["token_hash"],
    });
    expectIndex(table, {
      name: "document_share_links_document_id_idx",
      unique: false,
      columns: ["document_id"],
    });
    expectIndex(table, {
      name: "document_share_links_document_id_active_unique",
      unique: true,
      columns: ["document_id"],
    });
    expectForeignKey(table, "document_share_links_document_id_documents_id_fk");
    expectForeignKey(
      table,
      "document_share_links_created_by_user_id_users_id_fk",
    );
  });

  it("allows at most one active share link per document", () => {
    const table = schema.documentShareLinks as TableExport;
    const index = getTableConfig(table).indexes.find(
      (candidate) =>
        candidate.config.name ===
        "document_share_links_document_id_active_unique",
    );

    expect(index?.config.unique).toBe(true);
    expect(index?.config.where).toBeDefined();

    const { sql } = new PgDialect().sqlToQuery(index!.config.where!);
    expect(sql).toContain('"revoked_at" is null');
  });
});
