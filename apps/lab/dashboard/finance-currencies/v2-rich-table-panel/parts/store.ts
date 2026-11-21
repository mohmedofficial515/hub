import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CURRENCIES,
  FX_ENVELOPE,
  FX_HISTORY,
  FX_OVERRIDES,
  FX_RATES,
  FX_REFRESH_PROPOSAL,
  applyMargin,
  fmtDec,
  fmtRate,
  marginOf,
  parseDec,
  type FxOverride,
  type PaymentMode,
} from '@lab/mocks/currencies';
import { BASE, CLOCK_START, buildMeta, type Meta, type Row } from './derive';
import { fill, type CurrencyMessages } from '../i18n';

export interface Toast {
  id: number;
  message: string;
  undo?: () => void;
}

export type Scenario = 'ok' | 'loading' | 'error';

export interface DiffRow {
  code: string;
  oldEffective: string;
  newEffective: string;
  oldRaw: string;
  newRaw: string;
  deltaPct: number;
  outlier: boolean;
  pinned: boolean;
  unchanged: boolean;
  decimals: number;
}

const initialRows = (): Row[] =>
  CURRENCIES.map((currency) => {
    const rate = FX_RATES.find((r) => r.currency === currency.code)!;
    return { currency, rate, history: FX_HISTORY[currency.code] ?? [rate.effective] };
  });

function readScenario(): Scenario {
  try {
    const q = location.hash.split('?')[1] ?? '';
    const s = new URLSearchParams(q).get('scenario');
    return s === 'loading' || s === 'error' ? s : 'ok';
  } catch {
    return 'ok';
  }
}

const bumpMinutes = (iso: string, min: number) => new Date(new Date(iso).getTime() + min * 60_000).toISOString();

export function useCurrencyLab(t: CurrencyMessages) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [overrides, setOverrides] = useState<FxOverride[]>(FX_OVERRIDES);
  const [clock, setClock] = useState(CLOCK_START);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [scenario, setScenario] = useState<Scenario>(readScenario);
  const [diff, setDiff] = useState<{ phase: 'loading' | 'ready'; rows: DiffRow[] } | null>(null);
  const toastId = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((id) => window.clearTimeout(id));
  }, []);

  // The initial "loading" scenario resolves into the data after a moment.
  useEffect(() => {
    if (scenario !== 'loading') return;
    const id = window.setTimeout(() => setScenario('ok'), 2600);
    return () => window.clearTimeout(id);
  }, [scenario]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const dismissToast = useCallback((id: number) => setToasts((l) => l.filter((x) => x.id !== id)), []);
  const pushToast = useCallback(
    (message: string, undo?: () => void) => {
      const id = ++toastId.current;
      setToasts((l) => [...l.slice(-2), { id, message, undo }]);
      timers.current.push(window.setTimeout(() => dismissToast(id), 6500));
    },
    [dismissToast],
  );

  const metas: Meta[] = useMemo(() => rows.map((r) => buildMeta(r, overrides, clock)), [rows, overrides, clock]);

  const patchRow = (code: string, fn: (r: Row) => Row) =>
    setRows((list) => list.map((r) => (r.currency.code === code ? fn(r) : r)));

  const setEnabled = useCallback((code: string, enabled: boolean) => {
    setRows((list) =>
      list.map((r) => (r.currency.code === code ? { ...r, currency: { ...r.currency, enabled } } : r)),
    );
  }, []);

  const toggleVisible = (code: string) => {
    if (code === BASE) return;
    const row = rows.find((r) => r.currency.code === code);
    if (!row) return;
    const next = !row.currency.enabled;
    setEnabled(code, next);
    pushToast(fill(next ? t.toast.shown : t.toast.hidden, { code }), () => {
      setEnabled(code, !next);
      pushToast(t.toast.undone);
    });
  };

  const setVisibleMany = (codes: string[], enabled: boolean) => {
    const targets = codes.filter((c) => c !== BASE);
    const before = new Map(rows.map((r) => [r.currency.code, r.currency.enabled]));
    targets.forEach((c) => setEnabled(c, enabled));
    pushToast(fill(enabled ? t.toast.shown : t.toast.hidden, { code: targets.join(', ') }), () => {
      targets.forEach((c) => setEnabled(c, before.get(c) ?? true));
      pushToast(t.toast.undone);
    });
  };

  const setPaymentMode = (code: string, mode: PaymentMode, chargeCurrency: string | null) => {
    patchRow(code, (r) => {
      const degraded = mode === 'CHARGEABLE' && !r.currency.gatewaySupported;
      const charge = mode === 'DISPLAY_ONLY' ? chargeCurrency : null;
      return {
        ...r,
        currency: {
          ...r.currency,
          paymentMode: mode,
          chargeCurrency: charge,
          degraded,
          effectivePaymentMode: degraded ? 'DISPLAY_ONLY' : mode,
          effectiveChargeCurrency: degraded ? 'USD' : (charge ?? 'USD'),
        },
      };
    });
    pushToast(fill(t.toast.mode, { code }));
  };

  const setMargin = (code: string, pct: number | null) => {
    const pinned = overrides.some((o) => o.quoteCurrency === code && o.active && !o.revokedAt);
    patchRow(code, (r) => {
      const currency = { ...r.currency, marginPercentOverride: pct };
      const m = marginOf(currency);
      const market = applyMargin(r.rate.raw, m);
      return {
        currency,
        rate: pinned ? r.rate : { ...r.rate, effective: market },
        history: [...r.history.slice(0, -1), market],
      };
    });
    pushToast(fill(t.toast.margin, { code }));
  };

  const pinRate = (code: string, rate: string, expiresInDays: number | null, note: string) => {
    const normalized = fmtDec(parseDec(rate), 8);
    const expiresAt = expiresInDays ? bumpMinutes(clock, expiresInDays * 1440) : null;
    const id = `ovr_${code.toLowerCase()}_${Date.now() % 100000}`;
    setOverrides((list) => [
      {
        id,
        quoteCurrency: code,
        rate: normalized,
        active: true,
        createdAt: clock,
        createdById: 'staff_you',
        expiresAt,
        revokedAt: null,
        revokedById: null,
        note: note.trim() || null,
      },
      ...list.map((o) =>
        o.quoteCurrency === code && o.active && !o.revokedAt
          ? { ...o, active: false, revokedAt: clock, revokedById: 'staff_you' }
          : o,
      ),
    ]);
    patchRow(code, (r) => ({
      ...r,
      rate: { ...r.rate, effective: normalized, source: 'manual', provider: 'manual', expiresAt },
    }));
    pushToast(fill(t.toast.pinned, { code, rate: normalized }));
  };

  const revokePin = (overrideId: string) => {
    const o = overrides.find((x) => x.id === overrideId);
    if (!o) return;
    setOverrides((list) =>
      list.map((x) => (x.id === overrideId ? { ...x, active: false, revokedAt: clock, revokedById: 'staff_you' } : x)),
    );
    patchRow(o.quoteCurrency, (r) => ({
      ...r,
      rate: {
        ...r.rate,
        effective: applyMargin(r.rate.raw, marginOf(r.currency)),
        source: 'provider',
        provider: FX_ENVELOPE.provider,
        expiresAt: null,
      },
    }));
    pushToast(fill(t.toast.revoked, { code: o.quoteCurrency }));
  };

  const refreshOne = (code: string) => {
    if (code === BASE || busy.has(code)) return;
    setBusy((s) => new Set(s).add(code));
    later(() => {
      const nowIso = bumpMinutes(clock, 1);
      setClock(nowIso);
      const pinned = overrides.some((o) => o.quoteCurrency === code && o.active && !o.revokedAt);
      patchRow(code, (r) => {
        if (pinned) return { ...r, rate: { ...r.rate, fetchedAt: nowIso, isStale: false } };
        const raw = applyMargin(r.rate.raw, 0.1);
        const market = applyMargin(raw, marginOf(r.currency));
        return {
          ...r,
          rate: { ...r.rate, raw, effective: market, fetchedAt: nowIso, isStale: false },
          history: [...r.history, market].slice(-8),
        };
      });
      setBusy((s) => {
        const n = new Set(s);
        n.delete(code);
        return n;
      });
      pushToast(fill(pinned ? t.toast.pinKept : t.toast.refreshedOne, { code }));
    }, 950);
  };

  const copyRate = async (code: string) => {
    const row = rows.find((r) => r.currency.code === code);
    if (!row) return;
    const text = fmtRate(row.rate.effective, row.currency.decimalDigits === 3 ? 5 : 4);
    try {
      await navigator.clipboard.writeText(row.rate.effective);
      pushToast(fill(t.toast.copied, { code, rate: text }));
    } catch {
      pushToast(t.toast.copyFail);
    }
  };

  const startRefresh = () => {
    setDiff({ phase: 'loading', rows: [] });
    later(() => {
      const list: DiffRow[] = rows
        .filter((r) => r.currency.code !== BASE)
        .map((r) => {
          const code = r.currency.code;
          const pinned = overrides.some((o) => o.quoteCurrency === code && o.active && !o.revokedAt);
          const newRaw = FX_REFRESH_PROPOSAL[code] ?? r.rate.raw;
          const newEff = applyMargin(newRaw, marginOf(r.currency));
          const marketOld = r.history[r.history.length - 1] ?? r.rate.effective;
          const oldBase = pinned ? r.rate.effective : marketOld;
          const newBase = pinned ? r.rate.effective : newEff;
          const old = Number(parseDec(oldBase));
          const delta = old === 0 ? 0 : ((Number(parseDec(newBase)) - old) / old) * 100;
          return {
            code,
            oldEffective: oldBase,
            newEffective: newBase,
            oldRaw: r.rate.raw,
            newRaw,
            deltaPct: Math.round(delta * 100) / 100,
            outlier: !pinned && Math.abs(delta) >= 5,
            pinned,
            unchanged: !pinned && newRaw === r.rate.raw && !r.rate.isStale,
            decimals: r.currency.decimalDigits,
          };
        });
      setDiff({ phase: 'ready', rows: list });
    }, 1100);
  };

  const applyRefresh = (codes: string[]) => {
    const nowIso = bumpMinutes(clock, 2);
    setClock(nowIso);
    setRows((list) =>
      list.map((r) => {
        const code = r.currency.code;
        if (!codes.includes(code)) return r;
        const newRaw = FX_REFRESH_PROPOSAL[code] ?? r.rate.raw;
        const market = applyMargin(newRaw, marginOf(r.currency));
        return {
          ...r,
          rate: { ...r.rate, raw: newRaw, effective: market, fetchedAt: nowIso, isStale: false },
          history: [...r.history, market].slice(-8),
        };
      }),
    );
    setDiff(null);
    pushToast(fill(t.toast.applied, { n: codes.length }));
  };

  const discardRefresh = () => {
    setDiff(null);
    pushToast(t.toast.discarded);
  };

  const exportCsv = (codes: string[]) => {
    const head = ['code', 'name_ar', 'name_en', 'name_tr', 'abbr_ar', 'abbr_en', 'abbr_tr', 'raw', 'effective', 'source', 'enabled', 'payment_mode', 'margin_percent', 'fetched_at'];
    const lines = metas
      .filter((m) => codes.includes(m.code))
      .map((m) => {
        const c = m.row.currency;
        const r = m.row.rate;
        return [c.code, c.names.ar, c.names.en, c.names.tr, c.abbr.ar, c.abbr.en, c.abbr.tr, r.raw, r.effective, r.source, c.enabled, c.effectivePaymentMode, m.margin, r.fetchedAt]
          .map((v) => `"${String(v).replaceAll('"', '""')}"`)
          .join(',');
      });
    try {
      const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'currencies.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* the toast below still confirms the intent in preview contexts */
    }
    pushToast(fill(t.toast.exported, { n: lines.length }));
  };

  return {
    metas,
    overrides,
    clock,
    busy,
    toasts,
    scenario,
    setScenario,
    diff,
    dismissToast,
    toggleVisible,
    setVisibleMany,
    setPaymentMode,
    setMargin,
    pinRate,
    revokePin,
    refreshOne,
    copyRate,
    startRefresh,
    applyRefresh,
    discardRefresh,
    exportCsv,
  };
}

export type CurrencyLab = ReturnType<typeof useCurrencyLab>;
