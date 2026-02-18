// Ambient module declarations to satisfy TypeScript for dynamic ESM imports
declare module 'monaco-editor/esm/vs/editor/editor.api' {
  const monaco: any
  export = monaco
}

declare module 'monaco-editor'
