import { createLazyModule } from './lazyModule'

/**
 * Practice challenges, their checks, and the JavaScript parser the checks use load only
 * for a practice project (or when the Practice Lab opens), not on every visit.
 */
export const practiceLabModule = createLazyModule(() => import('./practiceLab'))
