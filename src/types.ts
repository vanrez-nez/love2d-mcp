export type RecordKind =
  | "module"
  | "function"
  | "callback"
  | "method"
  | "type"
  | "enum"
  | "constant"
  | "argument"
  | "return"
  | "table";

export interface ApiRecord {
  id: string;
  fullname: string;
  name: string;
  kind: RecordKind;
  description?: string;
  module?: string;
  parent_function?: string;
  parent_type?: string;
  search_text: string;
  value_type?: string;
  introduced_from?: string;
  deprecated_from?: string;
  removed_from?: string;
  examples?: string[];
  notes?: string[];
  see_also?: string[];
  signatures?: any[]; // Simplified for now
  variants?: any[];
}

export interface LoveApiDb {
  version: string;
  generated_at: string;
  records: ApiRecord[];
  by_id: Record<string, number>;
  by_fullname: Record<string, number>;
  inverted_index: Record<string, string[]>;
}

export interface DumpVersion {
  version: string;
  generated_at: string;
  hash?: string; // Not in current submodule but in design spec
}
