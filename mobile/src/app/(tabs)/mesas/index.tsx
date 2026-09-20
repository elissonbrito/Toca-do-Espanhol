import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { createOrder } from '@/api/orders';
import { fetchTables, setTableStatus, type RestaurantTable } from '@/api/tables';
import { AppButton } from '@/components/app-button';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing, TableCardPalette } from '@/constants/theme';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';

export default function MesasScreen() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      setTables(await fetchTables());
      setError(null);
    } catch {
      if (!silent) setError('Não foi possível carregar as mesas.');
    }
  }, []);

  useEffect(() => {
    load().finally(() => setIsLoading(false));
  }, [load]);

  useAutoRefresh(useCallback(() => load(true), [load]));

  async function handleRefresh() {
    setIsRefreshing(true);
    await load(true);
    setIsRefreshing(false);
  }

  async function handleOpenComanda(table: RestaurantTable) {
    setBusyId(table.id);
    try {
      const order = await createOrder({ table: table.id });
      await load(true);
      router.push(`/pedidos/${order.id}`);
    } catch (err: any) {
      Alert.alert('Erro', err?.response?.data?.table ?? 'Não foi possível abrir a comanda.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSetStatus(table: RestaurantTable, status: RestaurantTable['status']) {
    setBusyId(table.id);
    try {
      await setTableStatus(table.id, status);
      await load(true);
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar o status da mesa.');
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText color="muted">{error}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={tables}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.gold} />
        }
        ListEmptyComponent={
          <ThemedText color="muted" style={styles.empty}>
            Nenhuma mesa cadastrada.
          </ThemedText>
        }
        renderItem={({ item }) => {
          const palette = TableCardPalette[item.status];
          const billAtCashier = item.active_order_status === 'FECHAMENTO' || item.status === 'CONTA';
          const isBusy = busyId === item.id;

          return (
            <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.bg }]}>
              <View style={styles.cardHeader}>
                <View>
                  <ThemedText type="subtitle">Mesa {item.number}</ThemedText>
                  <ThemedText type="small" color="muted">
                    {item.seats} lugares
                  </ThemedText>
                </View>
                <StatusBadge status={item.status} label={item.status_display} />
              </View>

              {item.observation && (
                <ThemedText type="small" color="muted" numberOfLines={2}>
                  {item.observation}
                </ThemedText>
              )}
              {billAtCashier && (
                <ThemedText type="small" style={styles.warning}>
                  Conta no caixa — atualize quando os clientes saírem.
                </ThemedText>
              )}

              <View style={styles.actions}>
                {item.status === 'LIVRE' && (
                  <AppButton
                    label="Abrir Comanda"
                    onPress={() => handleOpenComanda(item)}
                    loading={isBusy}
                    style={styles.actionButton}
                  />
                )}

                {item.active_order_id && (
                  <AppButton
                    label={billAtCashier ? 'Ver conta' : 'Ver / Lançar itens'}
                    onPress={() => router.push(`/pedidos/${item.active_order_id}`)}
                    style={styles.actionButton}
                  />
                )}

                {(billAtCashier || (item.status === 'OCUPADA' && !item.active_order_id)) && (
                  <View style={styles.actionRow}>
                    <AppButton
                      label="Aguardando limpeza"
                      variant="ghost"
                      onPress={() => handleSetStatus(item, 'LIMPEZA')}
                      loading={isBusy}
                      style={styles.actionButtonSmall}
                    />
                    <AppButton
                      label="Mesa livre"
                      variant="gold"
                      onPress={() => handleSetStatus(item, 'LIVRE')}
                      loading={isBusy}
                      style={styles.actionButtonSmall}
                    />
                  </View>
                )}

                {item.status === 'LIMPEZA' && (
                  <AppButton
                    label="Marcar como Livre"
                    variant="gold"
                    onPress={() => handleSetStatus(item, 'LIVRE')}
                    loading={isBusy}
                    style={styles.actionButton}
                  />
                )}

                {item.status === 'RESERVADA' && !item.active_order_id && (
                  <AppButton
                    label="Abrir Comanda (check-in)"
                    onPress={() => handleOpenComanda(item)}
                    loading={isBusy}
                    style={styles.actionButton}
                  />
                )}
              </View>
            </View>
          );
        }}
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
  row: {
    gap: Spacing.three,
  },
  card: {
    flex: 1,
    borderWidth: 2,
    borderRadius: Radius.xl,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  warning: {
    color: Colors.goldLight,
  },
  actions: {
    gap: Spacing.one,
    marginTop: 'auto',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  actionButton: {
    paddingVertical: Spacing.one + 2,
  },
  actionButtonSmall: {
    flex: 1,
    paddingVertical: Spacing.one,
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
});
