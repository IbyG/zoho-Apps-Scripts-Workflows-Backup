# Data Context icons

Static icon assets for the Data Context cards on the export page (CRM, Books, and other systems).

## Add an icon

1. Place the file in this folder (`web/public/icons/`).
2. Set `iconPath` on the matching system in `web/Full-Design.json` → `rightPanel.systems[]`.

Example:

```json
{
  "id": "crm",
  "displayName": "Zoho CRM",
  "iconPath": "/icons/crm.svg"
}
```

Vite serves files from `web/public/` at the site root, so paths always start with `/icons/`.

## Supported formats

- Prefer **SVG** for sharp rendering at any size.
- Raster images (PNG, WebP, etc.) work if they are square (for example 64×64 or 128×128) with a transparent background when possible.

## Fallback behavior

If `iconPath` is omitted, the file is missing, or the image fails to load, the UI shows a built-in Material Symbol for that system (`hub` for CRM, `account_balance` for Books, and so on).

## Verify

From `web/`:

```bash
npm run dev
```

Open the export page and confirm each Data Context card shows the expected icon.

## Full guide

See [adding-data-context-icons.md](../../../Maintenance-Documentation/adding-data-context-icons.md) for system IDs, troubleshooting, and production build checks.
