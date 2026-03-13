import { type RefObject } from 'react';

import {
  DRAWER_QUICK_NAV_LABELS,
  getProductCardHealth,
  getProductCardHealthLabel,
  type DrawerQuickNavSection,
  type ProductWithCosting,
} from '@/src/view-models/productCostingDashboard';
import type { DrawerAction } from './DrawerActions';
import { DrawerActions } from './DrawerActions';
import { DrawerBreakdown } from './DrawerBreakdown';
import { DrawerMissingItems } from './DrawerMissingItems';
import { DrawerSummaryCards } from './DrawerSummaryCards';

function getContextFromSearch(): { branch: string; asOf: string } {
  if (typeof window === 'undefined') {
    return { branch: '—', asOf: '—' };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    branch: params.get('branch') || '—',
    asOf: params.get('asOf') || '—',
  };
}

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

  const health = getProductCardHealth(props.selected.costing);
  const healthLabel = getProductCardHealthLabel(health);
  const context = getContextFromSearch();

  return (
    <aside ref={props.drawerRef} className="card costingDrawer" style={{ marginBottom: 0, position: 'sticky', top: 88, alignSelf: 'start' }} aria-label="Detalle de producto">
      <header className="costingDrawer__header">
        <div>
          <p className="muted" style={{ fontSize: 12 }}>Ficha de producto</p>
          <h2 style={{ margin: '2px 0 0', fontSize: 20 }}>{props.selected.product.name}</h2>
          <p className="costingDrawer__context">{context.branch} · al {context.asOf}</p>
        </div>
        <button ref={props.closeButtonRef} type="button" className="btnSecondary btnSmall" onClick={props.onClose}>Cerrar</button>
      </header>

      <div className="costingDrawer__statusRow">
        <span className={`costingProductCard__stateTag costingProductCard__stateTag--${health}`}>{healthLabel}</span>
        <span className="costingDrawer__statusHint">Acciones sugeridas: {props.actions.length}</span>
      </div>

      <nav className="costingDrawer__quickNav" aria-label="Navegación rápida">
        <button type="button" className={`costingDrawer__quickNavBtn ${props.activeDrawerSection === 'actions' ? 'costingDrawer__quickNavBtn--active' : ''}`} aria-pressed={props.activeDrawerSection === 'actions'} onClick={() => props.onGoSection('actions')}>{DRAWER_QUICK_NAV_LABELS.actions}</button>
        <button type="button" className={`costingDrawer__quickNavBtn ${props.activeDrawerSection === 'breakdown' ? 'costingDrawer__quickNavBtn--active' : ''}`} aria-pressed={props.activeDrawerSection === 'breakdown'} onClick={() => props.onGoSection('breakdown')}>{DRAWER_QUICK_NAV_LABELS.breakdown}</button>
        <button type="button" className={`costingDrawer__quickNavBtn ${props.activeDrawerSection === 'missingItems' ? 'costingDrawer__quickNavBtn--active' : ''}`} aria-pressed={props.activeDrawerSection === 'missingItems'} onClick={() => props.onGoSection('missingItems')}>{DRAWER_QUICK_NAV_LABELS.missingItems}</button>
      </nav>

      <div style={{ marginTop: 10 }}><DrawerSummaryCards selected={props.selected} /></div>
      <section ref={props.actionsSectionRef} style={{ scrollMarginTop: 110, marginTop: 10 }}><DrawerActions actions={props.actions} /></section>
      <section ref={props.breakdownSectionRef} style={{ scrollMarginTop: 110 }}><DrawerBreakdown selected={props.selected} /></section>
      <section ref={props.missingItemsSectionRef} style={{ scrollMarginTop: 110 }}><DrawerMissingItems selected={props.selected} /></section>
    </aside>
  );
}
