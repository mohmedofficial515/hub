/**
 * @file paging.ts
 * @description How many dictionary rows the Schema Studio shows at once (review M11). Its own module so a test can draw the same paging with
 * a few rows instead of hundreds: a table of 600 rows takes seconds to render in jsdom, and went past the test's time under a full run.
 */

/** Rows shown at once; "Show more" adds as many again. */
export const PAGE_ROWS = 600;
