/**
 * Focus rings (review v3 B3). Teal `--secondary` is only 2.57:1 on white, so controls on light surfaces use a
 * full-opacity navy ring in light mode and teal in dark mode (6.98:1 on the dark card). Controls on the always-dark
 * board / status bar keep the teal ring, which measures above 4.5:1 on navy and near-black.
 */
export const ringLight =
  'outline-none focus-visible:ring-[3px] focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card dark:focus-visible:ring-secondary';

/** For controls on the near-black board (`bg-primary-dark`). */
export const ringBoard =
  'outline-none focus-visible:ring-[3px] focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark';

/** For controls on the navy status bar (`bg-primary` light / `bg-ocean-deep` dark). */
export const ringBar =
  'outline-none focus-visible:ring-[3px] focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary dark:focus-visible:ring-offset-ocean-deep';
