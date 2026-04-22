Drop your custom Data Context icons in this folder, then reference them from:

- `web/Full-Design.json` → `rightPanel.systems[].iconPath`

Format examples:

- `crm.svg`
- `books.png`
- `inventory.webp`

Configuration example:

```json
{
  "id": "crm",
  "displayName": "Zoho CRM",
  "iconPath": "/icons/crm.svg"
}
```

If `iconPath` is missing (or the image fails to load), the UI falls back to the default Material icon.
