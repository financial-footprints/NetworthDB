# API Response Pattern Examples (Target Contract)

camelCase JSON. Lists use root `{ items, total }`; details use `{ data }`; deletes use `204`.

## 1. List — `GET /api/v1/categories`

```json
{
  "items": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Groceries",
      "createdAt": "2026-01-15T12:00:00.000Z"
    }
  ],
  "total": 1
}
```

Bruno:

```bru
assert {
  res.status: eq 200
  res.body.items: isArray
  res.body.total: gte 1
}
```

## 2. Details — `GET /api/v1/accounts/{accountId}`

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "label": "HDFC Savings",
    "accountType": "bank",
    "bank": "HDFC",
    "openingDate": "2020-01-01",
    "closingDate": null,
    "accountNumber": "****1234",
    "createdAt": "2026-01-10T08:00:00.000Z",
    "updatedAt": "2026-01-12T14:30:00.000Z"
  }
}
```

Bruno:

```bru
assert {
  res.status: eq 200
  res.body.data.id: isDefined
  res.body.data.accountType: eq bank
}
```

## 3. Nullable Details — Valid Absence

```json
{
  "data": null
}
```

HTTP `200` when the parent exists but the optional child does not.

## 4. Delete — `DELETE /api/v1/categories/{categoryId}`

HTTP `204`, empty body.

Bruno:

```bru
assert {
  res.status: eq 204
}
```

## 5. Health — `GET /health`

```json
{
  "ok": true
}
```

Not wrapped in `{ data }`.

## 6. Error — Validation

HTTP `400`:

```json
{
  "error": "Bank name is required.",
  "code": "VALIDATION_ERROR",
  "field": "bank"
}
```

## 7. Error — Unauthorized

HTTP `401`:

```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED",
  "details": { "reason": "..." }
}
```
