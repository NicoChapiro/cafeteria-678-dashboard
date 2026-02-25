import { applyNewVersion } from '../src/services/versioning';

const existing = [
  {
    validFrom: new Date('2026-01-01T00:00:00.000Z'),
    validTo: null,
  },
];

const next = applyNewVersion(existing, {
  validFrom: new Date('2026-03-01T00:00:00.000Z'),
  validTo: null,
});

const printable = next.map((version) => ({
  valid_from: version.validFrom.toISOString().slice(0, 10),
  valid_to: version.validTo ? version.validTo.toISOString().slice(0, 10) : null,
}));

console.log('Sanity result:', JSON.stringify(printable, null, 2));
console.log(
  'Previous closed at:',
  printable[0]?.valid_to,
  '(expected 2026-02-28)',
);
