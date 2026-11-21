/** Files under the version's `media/` (screenshots, evidence, the explainer video and its captions), as served URLs. */
const files = import.meta.glob<string>('../media/**/*.{png,jpg,jpeg,webp,mp4,vtt}', { eager: true, query: '?url', import: 'default' });

/** Undefined for a file that is not there, so an element gets no `src` rather than an empty one. */
export const mediaUrl = (relative: string): string | undefined => files[`../media/${relative}`];
