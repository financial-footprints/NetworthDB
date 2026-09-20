export type DatabaseSchemaDescription = {
  overview: string;
  tables: Array<{
    name: string;
    summary: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      primaryKey?: boolean;
      jsonShape?: string;
    }>;
    foreignKeys: Array<{
      columns: string[];
      referencedTable: string;
      referencedColumns: string[];
    }>;
    notes?: string[];
  }>;
  enums: Array<{ name: string; values: string[] }>;
};

export type ReadonlySqlResult = {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
};

export interface ReadonlySqlExecutor {
  describeSchema(): DatabaseSchemaDescription;
  executeSelect(sql: string, userId: string): Promise<ReadonlySqlResult>;
}
