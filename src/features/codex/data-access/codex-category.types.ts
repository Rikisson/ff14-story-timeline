export interface CodexCategory {
  id: string;
  label: string;
  color?: string;
  description?: string;
}

export interface CodexCategoriesConfig {
  categories: CodexCategory[];
  updatedAt?: number;
}

export const EMPTY_CODEX_CATEGORIES_CONFIG: CodexCategoriesConfig = { categories: [] };
