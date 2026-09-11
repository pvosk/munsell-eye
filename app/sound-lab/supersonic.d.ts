// Package 0.80.0 does not expose its declaration file through its exports map.
// Describe only the API used by this lab.
declare module 'supersonic-scsynth' {
  export const SuperSonic: new (config: object) => import('./engine').Sonic;
}
