'use client'

import { useMemo } from 'react'
import { useSettings } from '@/contexts/settings-context'

export function useThemeColors() {
  const { resolvedTheme } = useSettings()
  const d = resolvedTheme === 'dark'
  return useMemo(() => ({
    d,
    /*
     * Surface and border values read the globals.css tokens rather than
     * restating them. Inline styles resolve var() against the cascade, so the
     * theme class already picks the right side and these need no `d` ternary.
     * Keeping literals here is what let this hook drift out of sync with the
     * tokens and paint every surface white regardless of the ramp.
     */
    cardBg: 'rgb(var(--surface))',
    cardBorder: 'rgb(var(--border) / var(--border-alpha))',
    cardHoverBorder: (accent: string) => d ? `${accent}33` : `${accent}44`,
    // Cards already sit at the top of the ramp, so hover lifts by edge, not fill.
    cardHoverBg: 'rgb(var(--surface))',
    surfaceBg: 'rgb(var(--surface-raised))',
    modalBg: 'rgb(var(--surface-overlay))',
    modalOverlay: d ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.45)',
    // Text
    textPrimary: 'rgb(var(--text-primary))',
    textSecondary: 'rgb(var(--text-secondary))',
    // Full opacity: the old 0.7 alpha dropped muted text to 3.3:1, under AA.
    textMuted: 'rgb(var(--text-muted))',
    textFaint: 'rgb(var(--text-muted) / 0.75)',
    // Accents
    accentLabel: d ? 'rgba(16,185,129,0.8)' : 'rgba(16,155,109,0.9)',
    accentGreen: 'rgb(16,185,129)',
    accentIndigo: '#6366f1',
    accentAmber: '#f59e0b',
    accentPink: '#ec4899',
    accentRed: '#ef4444',
    accentBlue: '#3b82f6',
    // Chart / progress
    barBg: d ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.12)',
    barToday: d ? 'linear-gradient(to top, rgb(16,185,129), rgb(52,211,153))' : 'linear-gradient(to top, rgb(16,185,129), rgb(52,211,153))',
    barShine: d ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.3)',
    progressBg: d ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    // States
    emptyBg: d ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
    hoverRow: d ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
    glowOpacity: d ? '0.06' : '0.04',
    iconBgAlpha: d ? '15' : '12',
    // Chips / badges
    chipBg: (positive: boolean) => d
      ? (positive ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)')
      : (positive ? 'rgba(16,185,129,0.08)' : 'rgba(0,0,0,0.03)'),
    chipColor: (positive: boolean) => positive ? 'rgb(16,185,129)' : (d ? 'rgba(139,139,158,0.5)' : 'rgba(140,140,160,0.5)'),
    shadow: d ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
    // Inputs & forms
    inputBg: 'rgb(var(--surface-raised))',
    // Controls answer to WCAG 1.4.11 (3:1), which is stricter than a card edge.
    inputBorder: 'rgb(var(--control-border))',
    inputFocusBorder: 'rgba(16,185,129,0.5)',
    inputText: d ? 'rgba(232,232,237,0.95)' : 'rgba(17,17,27,0.9)',
    inputPlaceholder: d ? 'rgba(139,139,158,0.5)' : 'rgba(140,140,160,0.5)',
    // Buttons
    btnPrimaryBg: d ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.1)',
    btnPrimaryHoverBg: d ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.18)',
    btnPrimaryText: d ? 'rgb(52,211,153)' : 'rgb(16,155,109)',
    btnPrimaryBorder: d ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.3)',
    btnSecondaryBg: d ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    btnSecondaryHoverBg: d ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    btnSecondaryText: d ? 'rgba(170,170,190,0.9)' : 'rgba(75,75,95,0.9)',
    btnSecondaryBorder: d ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    btnDangerBg: d ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)',
    btnDangerHoverBg: d ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.12)',
    btnDangerText: d ? 'rgb(252,165,165)' : 'rgb(220,38,38)',
    btnDangerBorder: d ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.3)',
    // Status colors
    statusPending: { bg: d ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.08)', text: d ? 'rgb(251,191,36)' : 'rgb(180,120,0)', border: d ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.25)' },
    statusActive: { bg: d ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.08)', text: d ? 'rgb(129,140,248)' : 'rgb(79,70,229)', border: d ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.25)' },
    statusCompleted: { bg: d ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.08)', text: d ? 'rgb(52,211,153)' : 'rgb(16,155,109)', border: d ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.25)' },
    statusOverdue: { bg: d ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.08)', text: d ? 'rgb(252,165,165)' : 'rgb(220,38,38)', border: d ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.25)' },
    // Table
    tableBg: 'rgb(var(--surface))',
    tableHeaderBg: 'rgb(var(--surface-raised))',
    tableDivider: d ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    // Tab / toggle active
    tabActiveBg: d ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.1)',
    tabActiveText: d ? 'rgb(52,211,153)' : 'rgb(16,155,109)',
    tabActiveBorder: d ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.35)',
    tabInactiveBg: d ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
    tabInactiveText: d ? 'rgba(139,139,158,0.7)' : 'rgba(100,100,120,0.7)',
    tabInactiveHoverBg: d ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.05)',
    tabInactiveHoverText: d ? 'rgb(52,211,153)' : 'rgb(16,155,109)',
    // Divider
    divider: d ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    // Drag/drop
    dropzoneBg: d ? 'rgba(16,185,129,0.03)' : 'rgba(16,185,129,0.03)',
    dropzoneActiveBg: d ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.06)',
    dropzoneBorder: d ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
    dropzoneActiveBorder: d ? 'rgba(16,185,129,0.4)' : 'rgba(16,185,129,0.5)',
    // Toggle switch
    toggleBg: d ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
    toggleActiveBg: 'rgb(16,185,129)',
  }), [d])
}
