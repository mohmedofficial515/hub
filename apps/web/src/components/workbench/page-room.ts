'use client';

/**
 * @file page-room.ts
 * @description What a page may ask of the layout around it. Apart from `layout.tsx`, because pages are what the layout's sidebar lists, so a page importing the layout would load in a circle.
 */
import { createContext, useContext } from 'react';

/** Tasks shows its List in place of the Board under 520 px, as a prop of the moment and not a change of the owner's chosen view (D54). */
export const PageRoom = createContext<{ boardTight: boolean }>({ boardTight: false });
export const usePageRoom = () => useContext(PageRoom);
