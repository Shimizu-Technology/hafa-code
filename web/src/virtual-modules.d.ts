declare module 'virtual:hafa-typescript-libraries' {
  const libraries: Readonly<Record<string, string>>
  export default libraries
}

/** Content-addressed Pyodide runtime directory, for example `assets/pyodide/0123456789ab/`. */
declare const __HAFA_PYODIDE_ASSET_DIRECTORY__: string
