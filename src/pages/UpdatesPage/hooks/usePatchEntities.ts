import { useEffect, useMemo, useState } from 'react';
import type { Hero } from '../../../../shared/types';
import type { ShopItem } from '../../../../shared/item-types';
import { entityLookup } from '../components/PatchNotes/patchText';

export function usePatchEntities(heroes: Hero[]) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [requests, setRequests] = useState(0);
  useEffect(() => {
    if (!requests) return;
    const controller = new AbortController();
    // Share the catalogue cache with the shop; no statistics or new library are loaded.
    void import('../../../services/itemsApi')
      .then(({ loadItems }) => loadItems(controller.signal))
      .then((catalog) => {
        if (!controller.signal.aborted) setItems(catalog.items);
      })
      .catch(() => {
        /* Official note text stays usable if metadata is unavailable. */
      });
    return () => controller.abort();
  }, [requests]);
  const lookup = useMemo(() => entityLookup(heroes, items), [heroes, items]);
  return {
    lookup,
    requestItems: () => {
      if (!items.length) setRequests((value) => value + 1);
    },
  };
}
