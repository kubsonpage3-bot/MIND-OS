# i18n Audit & Known Issues

This document tracks known limitations and upcoming work for the internationalization (i18n) of MIND OS.

## Known Limitations

### 1. `rpgEngine.js` Buff Descriptions (English Only)
**Status:** Known Issue  
**Details:** The `desc` field inside `BUFF_TYPES` in `src/lib/rpgEngine.js` is currently populated with English strings (e.g. `"Bonus XP for all tasks"`). Because this is a static config file, it does not use `react-i18next`'s `t()` function. 
**Impact:** When users switch to Russian (or any other language), the UI components (like `MutatorsPanel`) render these descriptions directly, causing English strings to appear. 
**Next Steps:** Update the UI components that render `buff.desc` (or `mut.desc`) to wrap them in a translation call, e.g. `t(\`buffs.${buff.id}_desc\`, buff.desc)`, and ensure the corresponding keys exist in `ru.json`.
