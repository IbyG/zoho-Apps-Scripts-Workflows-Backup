# Adding Data Context Icons

This guide explains how to add custom icons and map them to Data Context cards (for example: CRM, Books).

## Where Icons Live

- Put icon files in: `web/public/icons/`
- Public files are served directly by Vite, so icon URLs use `/icons/<filename>`

Examples:

- `web/public/icons/crm.svg`
- `web/public/icons/books.png`
- `web/public/icons/inventory.webp`

## Configure Icon Mapping

Open: `web/Full-Design.json`

For each Data Context, set `iconPath` inside `rightPanel.systems[]`.

Example:

```json
{
  "id": "crm",
  "displayName": "Zoho CRM",
  "iconPath": "/icons/crm.svg"
}
```

### Key Rules

- Add `iconPath` inside the correct system object (for example `crm`, `books`)
- `iconPath` must be a public icon URL starting with `/icons/`
- If no mapping exists (or image fails to load), UI falls back to the default Material icon

## How To Find the Correct System ID

System IDs come from the app design data:

- File: `web/Full-Design.json`
- Path: `rightPanel.systems[].id`

Example:

```json
{
  "id": "crm",
  "displayName": "Zoho CRM",
  "iconPath": "/icons/crm.svg"
}
```

## Recommended Icon Specs

- Prefer `SVG` for sharp rendering
- If using raster images, use square assets (for example 64x64 or 128x128)
- Keep transparent background when possible
- Keep visual weight balanced so all cards look consistent

## Verify Changes

From `web/` run:

```bash
npm run dev
```

Check Data Context cards:

- Custom icon appears in the card header
- Fallback Material icon appears if mapping/path is invalid

Optional production check:

```bash
npm run build
```

## Troubleshooting

- **Icon not showing**: confirm file exists in `web/public/icons/`
- **404 for icon**: confirm `iconPath` starts with `/icons/` and filename matches exactly
- **Wrong context updated**: confirm you edited the correct `rightPanel.systems[]` entry in `Full-Design.json`
- **Looks blurry**: switch to SVG or use higher-resolution square image
