import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { fetchKitchenItems, updateKitchenItemStatus } from '@/api/kitchen';
import type { ItemSector } from '@/api/menu';
import type { ItemStatus, OrderItem } from '@/api/orders';
import { AppButton } from '@/components/app-button';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';
import { preparationSectorForRole } from '@/utils/roles';

const SECTORS: { key: ItemSector; label: string }[] = [
  { key: 'COZINHA', label: 'Cozinha' },
  { key: 'PARRILLA', label: 'Parrilla' },
  { key: 'BAR', label: 'Bar' },
];

const NEXT_STATUS: Partial<Record<ItemStatus, ItemStatus>> = {
  PENDENTE: 'PREPARANDO',
  PREPARANDO: 'PRONTO',
  PRONTO: 'ENTREGUE',
};

const NEXT_LABEL: Partial<Record<ItemStatus, string>> = {
  PENDENTE: 'Iniciar preparo',
  PREPARANDO: 'Marcar como pronto',
  PRONTO: 'Marcar como entregue',
};

export default function CozinhaScreen() {
  const { user } = useAuth();
  const [sector, setSector] = useState<ItemSector>(preparationSectorForRole(user?.role));
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        setItems(await fetchKitchenItems(sector));
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [sector]
  );

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(useCallback(() => load(true), [load]));

  async function handleRefresh() {
    setIsRefreshing(true);
    await load(true);
    setIsRefreshing(false);
  }

  async function handleAdvance(item: OrderItem) {
    const next = NEXT_STATUS[item.status];
    if (!next) return;
    setBusyId(item.id);
    try {
      await updateKitchenItemStatus(item.id, next);
      await load(true);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.sectorRow}>
        {SECTORS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setSector(s.key)}
            style={[styles.sectorChip, sector === s.key && styles.sectorChipActive]}>
            <ThemedText type="smallBold" color={sector === s.key ? 'black' : 'muted'}>
              {s.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.gold} />
          }
          ListEmptyComponent={
            <ThemedText color="muted" style={styles.empty}>
              Nenhum item pendente neste setor.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <ThemedView card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="subtitle">
                    {item.quantity}x {item.product_name}
                  </ThemedText>
                  <ThemedText color="muted" type="small">
                    {item.order_ref}
                    {item.sector === 'PARRILLA' ? ' · Parrilla' : ''}
                  </ThemedText>
                  {item.observations ? (
                    <ThemedText color="muted" type="small">
                      Obs: {item.observations}
                    </ThemedText>
                  ) : null}
                </View>
                <StatusBadge status={item.status} label={item.status_display} />
              </View>
              {NEXT_STATUS[item.status] && (
                <AppButton
                  label={NEXT_LABEL[item.status] ?? 'Avançar'}
                  variant="gold"
                  onPress={() => handleAdvance(item)}
                  loading={busyId === item.id}
                />
              )}
            </ThemedView>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectorRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  sectorChip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingVertical: Spacing.two,
  },
  sectorChipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  list: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
});
