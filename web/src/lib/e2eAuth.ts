export const e2eAuthEnabled = import.meta.env.DEV
  && import.meta.env.MODE === 'e2e'
  && import.meta.env.VITE_E2E_AUTH === 'true'
