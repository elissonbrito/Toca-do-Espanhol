import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { fetchOrders, type Order } from '@/api/orders';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';
import { router } from 'expo-router';

const OPEN_STATUSES = new Set(['ABERTO', 'PREPARANDO', 'PRONTO', 'FECHAMENTO']);

export default function PedidosScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const all = await fetchOrders();
      setOrders(all.filter((o) => OPEN_STATUSES.has(o.status)));
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(useCallback(() => load(true), [load]));

  async function handleRefresh() {
    setIsRefreshing(true);
    await load(true);
    setIsRefreshing(false);
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.gold} />
        }
        ListEmptyComponent={
          <ThemedText color="muted" style={styles.empty}>
            Nenhum pedido em aberto. Abra uma comanda pela aba Mesas.
          </ThemedText>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/pedidos/${item.id}`)}>
            <ThemedView card style={styles.card}>
              <View style={styles.cardHeader}>
                <ThemedText type="subtitle">
                  {item.table ? `Mesa ${item.table.number}` : item.queue_ticket_code ? `Senha ${item.queue_ticket_code}` : `Comanda #${item.id}`}
                </ThemedText>
                <StatusBadge status={item.status} label={item.status_display} />
              </View>
              <ThemedText color="muted" type="small">
                {item.items.length} {item.items.length === 1 ? 'item' : 'itens'} · {item.people_count} pessoa(s)
              </ThemedText>
              <ThemedText type="subtitle" color="gold">
                R$ {item.total_amount}
              </ThemedText>
            </ThemedView>
          </Pressable>
        )}
      />
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
    backgroundColor: Colors.black,
  },
  list: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
});
