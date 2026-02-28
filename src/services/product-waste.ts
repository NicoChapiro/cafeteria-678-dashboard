import type { Product } from '@/src/domain/types';

export function getProductWasteRate(product: Product | null | undefined): number {
  return (product?.wasteRatePct ?? 3) / 100;
}
