/** A version's own storage prefix, so the three directions never read each other's remembered sizes. */
export const versionPrefix = () => `hub-wb:${location.hash.split('/')[2] ?? 'x'}`;
