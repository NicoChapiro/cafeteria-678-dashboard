import { getBadgeTone } from '@/src/view-models/productCostingDashboard';

export function ProductCardBadges({ badges }: { badges: string[] }) {
  return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{badges.map((badge) => (
    <span key={badge} className={`badge badge--${getBadgeTone(badge)}`}>{badge}</span>
  ))}</div>;
}
