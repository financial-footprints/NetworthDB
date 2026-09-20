# Account Taxonomy

Per-user transaction categories (two-level tree) and tags (flat many-to-many).

## Layout

| Path | Contents |
| ---- | -------- |
| `constants.ts` | `DEFAULT_CATEGORY_TREE`, limits |
| `normalize.ts` | `normalizeTaxonomyName` |
| `entities/category.ts` | `Category` |
| `entities/tag.ts` | `Tag` |
| `repositories/` | Persistence ports |
| `services/category-service.ts` | CRUD + `ensureDefaultCategories` |
| `services/tag-service.ts` | CRUD |

See ADR-007.
