import { applyNewVersion } from '@/src/services/versioning';
import type { Branch, Item, ItemCostVersion, NewItemCostVersion } from '@/src/domain/types';

type SerializedItem = Omit<Item, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

type SerializedItemCostVersion = Omit<
  ItemCostVersion,
  'validFrom' | 'validTo' | 'createdAt'
> & {
  validFrom: string;
  validTo: string | null;
  createdAt: string;
};

type LocalData = {
  items: Item[];
  itemCostVersions: ItemCostVersion[];
};

type SerializedLocalData = {
  items: SerializedItem[];
  itemCostVersions: SerializedItemCostVersion[];
};

const STORAGE_KEY = 'cafe678:data:v1';

function ensureBrowserStorage(): Storage {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('localStorage is only available in the browser');
  }

  return window.localStorage;
}

function toDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }

  return date;
}

function serializeData(data: LocalData): SerializedLocalData {
  return {
    items: data.items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    itemCostVersions: data.itemCostVersions.map((version) => ({
      ...version,
      validFrom: version.validFrom.toISOString(),
      validTo: version.validTo ? version.validTo.toISOString() : null,
      createdAt: version.createdAt.toISOString(),
    })),
  };
}

function deserializeData(data: SerializedLocalData): LocalData {
  return {
    items: data.items.map((item) => ({
      ...item,
      createdAt: toDate(item.createdAt),
      updatedAt: toDate(item.updatedAt),
    })),
    itemCostVersions: data.itemCostVersions.map((version) => ({
      ...version,
      validFrom: toDate(version.validFrom),
      validTo: version.validTo ? toDate(version.validTo) : null,
      createdAt: toDate(version.createdAt),
    })),
  };
}

function isSerializedData(value: unknown): value is SerializedLocalData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<SerializedLocalData>;
  return Array.isArray(candidate.items) && Array.isArray(candidate.itemCostVersions);
}

function readData(): LocalData {
  const storage = ensureBrowserStorage();
  const raw = storage.getItem(STORAGE_KEY);

  if (!raw) {
    return { items: [], itemCostVersions: [] };
  }

  const parsed: unknown = JSON.parse(raw);
  if (!isSerializedData(parsed)) {
    throw new Error('Stored data is invalid');
  }

  return deserializeData(parsed);
}

function writeData(data: LocalData): void {
  const storage = ensureBrowserStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify(serializeData(data)));
}

function buildId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function listItems(): Item[] {
  const data = readData();
  return [...data.items].sort((a, b) => a.name.localeCompare(b.name, 'es-CL'));
}

export function getItem(id: string): Item | undefined {
  return readData().items.find((item) => item.id === id);
}

export function upsertItem(
  item: Omit<Item, 'createdAt' | 'updatedAt'> &
    Partial<Pick<Item, 'createdAt' | 'updatedAt'>>,
): Item {
  const data = readData();
  const now = new Date();
  const current = data.items.find((entry) => entry.id === item.id);

  const nextItem: Item = {
    ...item,
    createdAt: current?.createdAt ?? item.createdAt ?? now,
    updatedAt: now,
  };

  const nextItems = current
    ? data.items.map((entry) => (entry.id === nextItem.id ? nextItem : entry))
    : [...data.items, nextItem];

  writeData({ ...data, items: nextItems });
  return nextItem;
}

export function deleteItem(id: string): void {
  const data = readData();
  writeData({
    items: data.items.filter((item) => item.id !== id),
    itemCostVersions: data.itemCostVersions.filter((version) => version.itemId !== id),
  });
}

export function listItemCosts(itemId: string, branch: Branch): ItemCostVersion[] {
  return readData()
    .itemCostVersions
    .filter((version) => version.itemId === itemId && version.branch === branch)
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());
}

export function addItemCostVersion(
  itemId: string,
  branch: Branch,
  newVersion: NewItemCostVersion,
): ItemCostVersion[] {
  const data = readData();
  const existingForKey = data.itemCostVersions
    .filter((version) => version.itemId === itemId && version.branch === branch)
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());

  const timeline = applyNewVersion(
    existingForKey.map((version) => ({
      validFrom: version.validFrom,
      validTo: version.validTo,
    })),
    {
      validFrom: newVersion.validFrom,
      validTo: newVersion.validTo ?? null,
    },
  );

  const updatedExisting = existingForKey.map((version) => {
    const match = timeline.find(
      (timelineVersion) =>
        timelineVersion.validFrom.getTime() === version.validFrom.getTime(),
    );

    return match ? { ...version, validTo: match.validTo } : version;
  });

  const insertedTimeline = timeline.at(-1);
  if (!insertedTimeline) {
    throw new Error('Failed to insert new item cost version');
  }

  const insertedVersion: ItemCostVersion = {
    id: buildId('item_cost'),
    itemId,
    branch,
    packQtyInBase: newVersion.packQtyInBase,
    packCostGrossClp: newVersion.packCostGrossClp,
    yieldRateOverride: newVersion.yieldRateOverride ?? null,
    validFrom: insertedTimeline.validFrom,
    validTo: insertedTimeline.validTo,
    createdAt: new Date(),
  };

  const untouched = data.itemCostVersions.filter(
    (version) => !(version.itemId === itemId && version.branch === branch),
  );

  const nextVersions = [...untouched, ...updatedExisting, insertedVersion];
  writeData({ ...data, itemCostVersions: nextVersions });

  return [...updatedExisting, insertedVersion].sort(
    (a, b) => a.validFrom.getTime() - b.validFrom.getTime(),
  );
}

export function exportData(): void {
  const data = readData();
  const payload = JSON.stringify(serializeData(data), null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cafe678-export-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();

  URL.revokeObjectURL(url);
}

export function importData(json: string): void {
  const parsed: unknown = JSON.parse(json);
  if (!isSerializedData(parsed)) {
    throw new Error('Invalid import payload: items and itemCostVersions are required');
  }

  const data = deserializeData(parsed);
  writeData(data);
}
