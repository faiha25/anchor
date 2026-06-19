'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import data from './resources.json';

const ResourceMap = dynamic(() => import('./ResourceMap'), {
  ssr: false,
  loading: () => <p className="text-[0.85rem] text-ink-soft py-4">Loading map</p>,
});

type Resource = {
  id: string;
  name: string;
  category: string;
  borough: string;
  address: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  note: string;
};

const all = data.resources as Resource[];

const SITUATION_CATEGORIES: Record<string, string[]> = {
  nonpayment_eviction: ['housing_court', 'tenant_support', 'rental_assistance'],
  holdover_eviction: ['housing_court', 'tenant_support'],
  court_notice_received: ['housing_court', 'tenant_support'],
  illegal_lockout: ['emergency_shelter', 'tenant_support', 'housing_court'],
  unsafe_conditions_repairs: ['housing_court', 'tenant_support'],
  income_loss_risk: ['rental_assistance', 'tenant_support'],
  partial_payment: ['rental_assistance', 'tenant_support'],
  landlord_harassment: ['tenant_support', 'emergency_dv', 'housing_court'],
  verbal_threat_no_notice: ['tenant_support', 'housing_court'],
  rent_increase_dispute: ['rental_assistance', 'tenant_support'],
  lease_termination: ['rental_assistance', 'tenant_support'],
  _crisis: ['emergency_dv', 'emergency_shelter', 'tenant_support'],
  _default: ['housing_court', 'tenant_support'],
};

export default function Resources({ situationKey }: { situationKey?: string }) {
  const [showMap, setShowMap] = useState(false);

  const cats = SITUATION_CATEGORIES[situationKey ?? '_default'] ?? SITUATION_CATEGORIES._default;
  const list = all.filter((r) => cats.includes(r.category));
  const pinned = list.filter((r) => r.lat !== null && r.lng !== null);

  if (list.length === 0) return null;

  return (
    <div className="rounded-2xl border border-hairline p-5 mb-6">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-ink-soft">
          Places near you that can help
        </p>
        {pinned.length > 0 && (
          <button
            onClick={() => setShowMap((s) => !s)}
            className="text-[0.8rem] text-accent font-medium underline underline-offset-2"
          >
            {showMap ? 'Hide map' : 'Show map'}
          </button>
        )}
      </div>
      <p className="text-[0.8rem] text-ink-soft mb-4">
        Free, public NYC resources. Confirm hours before going.
      </p>

      {showMap && pinned.length > 0 && (
        <div className="mb-4 rounded-xl overflow-hidden border border-hairline">
          <ResourceMap resources={pinned} />
        </div>
      )}

      <ul className="space-y-3">
        {list.map((r) => (
          <li key={r.id} className="rounded-xl bg-surface border border-hairline p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.95rem] font-medium text-ink">{r.name}</p>
                <p className="text-[0.85rem] text-ink-soft mt-0.5">{r.borough}</p>
              </div>
              <a
                href={`tel:${r.phone.replace(/[^0-9]/g, '')}`}
                className="shrink-0 text-[0.85rem] text-accent font-medium underline underline-offset-2"
              >
                {r.phone}
              </a>
            </div>
            {r.address && r.lat !== null && (
              <p className="text-[0.82rem] text-ink mt-2">{r.address}</p>
            )}
            <p className="text-[0.82rem] text-ink-soft mt-1">{r.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}