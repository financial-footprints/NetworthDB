export const DOCS_TAXONOMY_MARKDOWN = `# Taxonomy (ADR-007)

## Categories

Two levels only: root category (\`parent_id\` null) and subcategory (parent must be a root). At most one category and one subcategory per transaction; subcategory requires its parent category.

Names are unique per user (case-insensitive) within parent scope.

## Tags

Flat catalog; many-to-many via \`transaction_tag_assignments\`. Max 20 tags per transaction. Names unique per user (case-insensitive).

Statement ingest leaves taxonomy unset unless transaction rules set it.
`;
