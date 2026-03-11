import { type RefObject } from 'react';

import { DRAWER_QUICK_NAV_LABELS, type DrawerQuickNavSection, type ProductWithCosting } from '@/src/view-models/productCostingDashboard';
import type { DrawerAction } from './DrawerActions';
import { DrawerActions } from './DrawerActions';
import { DrawerBreakdown } from './DrawerBreakdown';
import { DrawerMissingItems } from './DrawerMissingItems';
import { DrawerSummaryCards } from './DrawerSummaryCards';

export function ProductDrawer(props: {
  selected: ProductWithCosting | null;
  onClose: () => void;
  drawerRef: RefObject<HTMLElement | null>;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  actionsSectionRef: RefObject<HTMLElement | null>;
  breakdownSectionRef: RefObject<HTMLElement | null>;
  missingItemsSectionRef: RefObject<HTMLElement | null>;
  activeDrawerSection: DrawerQuickNavSection | null;
  onGoSection: (section: DrawerQuickNavSection) => void;
  actions: DrawerAction[];
}) {
  if (!props.selected) return null;
  return (
    <aside ref={props.drawerRef} className="card" style={{ marginBottom: 0, position: 'sticky', top: 88, alignSelf: 'start' }} aria-label="Detalle de producto">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{props.selected.product.name}</h2>
        <button ref={props.closeButtonRef} type="button" className="btnSecondary" onClick={props.onClose}>Cerrar</button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button type="button" className="btnSecondary" aria-pressed={props.activeDrawerSection === 'actions'} onClick={() => props.onGoSection('actions')}>{DRAWER_QUICK_NAV_LABELS.actions}</button>
        <button type="button" className="btnSecondary" aria-pressed={props.activeDrawerSection === 'breakdown'} onClick={() => props.onGoSection('breakdown')}>{DRAWER_QUICK_NAV_LABELS.breakdown}</button>
        <button type="button" className="btnSecondary" aria-pressed={props.activeDrawerSection === 'missingItems'} onClick={() => props.onGoSection('missingItems')}>{DRAWER_QUICK_NAV_LABELS.missingItems}</button>
      </div>
      <div style={{ marginTop: 10 }}><DrawerSummaryCards selected={props.selected} /></div>
      <section ref={props.actionsSectionRef} style={{ scrollMarginTop: 110, marginTop: 10 }}><DrawerActions actions={props.actions} /></section>
      <section ref={props.breakdownSectionRef} style={{ scrollMarginTop: 110 }}><DrawerBreakdown selected={props.selected} /></section>
      <section ref={props.missingItemsSectionRef} style={{ scrollMarginTop: 110 }}><DrawerMissingItems selected={props.selected} /></section>
    </aside>
  );
}
