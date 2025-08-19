# Code Generation Scripts

This directory contains scripts that auto-generate code to reduce duplication and keep interfaces in sync.

## generate.js (Master Script)

Runs all generation scripts in the correct order. This is the recommended way to regenerate all auto-generated code.

### Usage:
```bash
# Run all generation scripts
pnpm generate

# Or directly
node scripts/generate.js
```

### What it runs:
1. `generate-communication-api.js` - Creates unified API layer
2. `generate-preload.js` - Auto-generates preload.ts from IPC handlers

## generate-preload.js

Auto-generates `electron/preload.ts` from IPC handler definitions in `electron/ipc-handlers.ts`.

### What it does:
- Scans `ipc-handlers.ts` for all `registerIPCHandler()` calls
- Extracts event listeners from the original preload.ts backup
- Generates a complete preload.ts with proper IPC method bindings
- Converts kebab-case handler names to camelCase API methods

### Usage:
```bash
# Auto-run during development
pnpm dev

# Manual generation
node scripts/generate-preload.js
```

### Adding new IPC handlers:
1. Add your handler in `electron/ipc-handlers.ts` using `registerIPCHandler()`
2. Run `pnpm generate:api` (or it runs automatically with `pnpm dev`)
3. Your handler is now available in the renderer as `window.electronAPI.yourMethodName()`

### Benefits:
- ✅ No more manual sync between IPC handlers and preload
- ✅ Automatic kebab-case to camelCase conversion
- ✅ Type-safe generated code
- ✅ Preserves event listeners with cleanup functions
- ✅ Consistent debug logging for all methods

### Example:
```typescript
// In ipc-handlers.ts
registerIPCHandler('my-new-feature', async (arg1, arg2) => {
  // implementation
});

// Auto-generated in preload.ts
myNewFeature: (...args: any[]) => 
  ipcRenderer.invoke('my-new-feature', ...args),

// Use in React
const result = await window.electronAPI.myNewFeature(data1, data2);
```