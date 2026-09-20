import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { fetchMenuCategories, fetchMenuItems, type MenuCategory, type MenuItemSummary } from '@/api/menu';
import {
  addOrderItem,
  cancelOrder,
  closeBill,
  fetchOrder,
  removeOrderItem,
  reopenBill,
  transferOrderTable,
  type Order,
  type OrderItem,
} from '@/api/orders';
import type { RestaurantTable } from '@/api/tables';
import { AppButton } from '@/components/app-button';
import { AppModal } from '@/components/app-modal';
import { StatusBadge } from '@/components/status-badge';
import { TablePickerModal } from '@/components/table-picker-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';
import { isCaixa, isCaixaOrAdmin, isFloorStaff } from '@/utils/roles';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const navigation = useNavigation();
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [isTransferModalVisible, setTransferModalVisible] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        setOrder(await fetchOrder(orderId));
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [orderId]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (order?.table) {
      navigation.setOptions({ title: `Mesa ${order.table.number}` });
    } else if (order?.queue_ticket_code) {
      navigation.setOptions({ title: `Senha ${order.queue_ticket_code}` });
    }
  }, [order, navigation]);

  useAutoRefresh(useCallback(() => load(true), [load]));

  async function handleRemoveItem(item: OrderItem) {
    Alert.alert('Remover item', `Remover ${item.product_name} da conta?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeOrderItem(orderId, item.id);
            load(true);
          } catch {
            Alert.alert('Erro', 'Não foi possível remover o item.');
          }
        },
      },
    ]);
  }

  async function handleCloseBill() {
    setIsBusy(true);
    try {
      setOrder(await closeBill(orderId));
    } catch (err: any) {
      Alert.alert('Erro', err?.response?.data?.detail ?? 'Não foi possível fechar a conta.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleReopenBill() {
    setIsBusy(true);
    try {
      setOrder(await reopenBill(orderId));
    } catch {
      Alert.alert('Erro', 'Não foi possível reabrir a conta.');
    } finally {
      setIsBusy(false);
    }
  }

  function handleCancelOrder() {
    Alert.alert('Cancelar conta', 'Cancelar esta conta? Essa ação não pode ser desfeita.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar conta',
        style: 'destructive',
        onPress: async () => {
          setIsBusy(true);
          try {
            await cancelOrder(orderId);
            router.back();
          } catch (err: any) {
            Alert.alert('Erro', err?.response?.data?.detail ?? 'Não foi possível cancelar a conta.');
            setIsBusy(false);
          }
        },
      },
    ]);
  }

  async function handleTransferTable(table: RestaurantTable) {
    setIsBusy(true);
    try {
      setOrder(await transferOrderTable(orderId, table.id));
      setTransferModalVisible(false);
    } catch (err: any) {
      Alert.alert('Erro', err?.response?.data?.table ?? 'Não foi possível trocar a mesa.');
    } finally {
      setIsBusy(false);
    }
  }

  if (isLoading || !order) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </ThemedView>
    );
  }

  const canAddItems = isFloorStaff(user?.role) && !['FECHAMENTO', 'FINALIZADO', 'CANCELADO'].includes(order.status);
  const canCloseBill =
    isFloorStaff(user?.role) && !['FECHAMENTO', 'FINALIZADO', 'CANCELADO'].includes(order.status) && order.items.some((i) => i.status !== 'CANCELADO');
  const canReopenBill = isCaixa(user?.role) && order.status === 'FECHAMENTO';
  const canRemoveItems = isCaixa(user?.role) && !['FINALIZADO', 'CANCELADO'].includes(order.status);
  const canCancelOrder = isCaixa(user?.role) && !['FINALIZADO', 'CANCELADO'].includes(order.status);
  const canTransferTable = isCaixaOrAdmin(user?.role) && !!order.table && !['FINALIZADO', 'CANCELADO'].includes(order.status);

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={order.items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <StatusBadge status={order.status} label={order.status_display} />
              <ThemedText type="subtitle" color="gold">
                R$ {order.total_amount}
              </ThemedText>
            </View>
            <ThemedText color="muted" type="small">
              {order.people_count} pessoa(s) · aberto por {order.opened_by.name}
              {order.customer_name ? ` · ${order.customer_name}` : ''}
            </ThemedText>
          </View>
        }
        ListEmptyComponent={
          <ThemedText color="muted" style={styles.empty}>
            Nenhum item lançado ainda.
          </ThemedText>
        }
        renderItem={({ item }) => (
          <ThemedView card style={[styles.itemCard, item.status === 'CANCELADO' && styles.itemCancelled]}>
            <View style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="default">
                  {item.quantity}x {item.product_name}
                </ThemedText>
                <ThemedText color="muted" type="small">
                  {item.sector_display} · R$ {item.unit_price} un.
                </ThemedText>
                {item.observations ? (
                  <ThemedText color="muted" type="small">
                    Obs: {item.observations}
                  </ThemedText>
                ) : null}
              </View>
              <StatusBadge status={item.status} label={item.status_display} />
            </View>
            <View style={styles.itemFooter}>
              <ThemedText type="smallBold" color="white">
                R$ {item.total_price}
              </ThemedText>
              {canRemoveItems && item.status !== 'CANCELADO' && (
                <Pressable onPress={() => handleRemoveItem(item)}>
                  <ThemedText type="small" style={{ color: Colors.redLight }}>
                    Remover
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </ThemedView>
        )}
      />

      <View style={styles.actions}>
        {canAddItems && (
          <AppButton label="+ Adicionar item" variant="gold" onPress={() => setAddModalVisible(true)} />
        )}
        {canCloseBill && (
          <AppButton label="Fechar conta" onPress={handleCloseBill} loading={isBusy} />
        )}
        {canReopenBill && (
          <AppButton label="Reabrir conta" variant="ghost" onPress={handleReopenBill} loading={isBusy} />
        )}
        {canTransferTable && (
          <AppButton
            label="Trocar de mesa"
            variant="ghost"
            onPress={() => setTransferModalVisible(true)}
            loading={isBusy}
          />
        )}
        {canCancelOrder && (
          <AppButton label="Cancelar conta" variant="danger" onPress={handleCancelOrder} loading={isBusy} />
        )}
      </View>

      <AddItemModal
        visible={isAddModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdded={() => {
          setAddModalVisible(false);
          load(true);
        }}
        orderId={orderId}
      />

      <TablePickerModal
        visible={isTransferModalVisible}
        title="Trocar de mesa"
        onClose={() => setTransferModalVisible(false)}
        onSelect={handleTransferTable}
        isSubmitting={isBusy}
      />
    </ThemedView>
  );
}

function AddItemModal({
  visible,
  onClose,
  onAdded,
  orderId,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  orderId: number;
}) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItemSummary[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<MenuItemSummary | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [observations, setObservations] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelected(null);
    setQuantity(1);
    setObservations('');
    setIsLoading(true);
    Promise.all([fetchMenuCategories(), fetchMenuItems()])
      .then(([cats, menuItems]) => {
        setCategories(cats);
        setItems(menuItems);
        setActiveCategory(cats[0]?.id ?? null);
      })
      .finally(() => setIsLoading(false));
  }, [visible]);

  async function handleConfirm() {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      await addOrderItem(orderId, { menu_item: selected.id, quantity, observations: observations || undefined });
      onAdded();
    } catch {
      Alert.alert('Erro', 'Não foi possível adicionar o item.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const visibleItems = items.filter((i) => i.category === activeCategory);

  return (
    <AppModal visible={visible} title="Adicionar item" onClose={onClose}>
      {isLoading ? (
        <ActivityIndicator color={Colors.gold} />
      ) : selected ? (
        <View style={styles.pickerColumn}>
          <ThemedText type="subtitle">{selected.name}</ThemedText>
          <ThemedText color="muted" type="small">
            R$ {selected.price} · {selected.sector_display}
          </ThemedText>
          {selected.description ? (
            <ThemedText color="muted" type="small">
              {selected.description}
            </ThemedText>
          ) : null}

          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepperButton}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
              <ThemedText type="subtitle">−</ThemedText>
            </Pressable>
            <ThemedText type="subtitle">{quantity}</ThemedText>
            <Pressable style={styles.stepperButton} onPress={() => setQuantity((q) => q + 1)}>
              <ThemedText type="subtitle">+</ThemedText>
            </Pressable>
          </View>

          <TextInput
            value={observations}
            onChangeText={setObservations}
            placeholder="Observações (opcional)"
            placeholderTextColor={Colors.muted}
            style={styles.textInput}
          />

          <View style={styles.modalActions}>
            <AppButton label="Voltar" variant="ghost" onPress={() => setSelected(null)} style={{ flex: 1 }} />
            <AppButton label="Confirmar" variant="gold" onPress={handleConfirm} loading={isSubmitting} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
            {categories.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => setActiveCategory(cat.id)}
                style={[styles.categoryChip, activeCategory === cat.id && styles.categoryChipActive]}>
                <ThemedText type="small" color={activeCategory === cat.id ? 'black' : 'white'}>
                  {cat.name}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
          <FlatList
            data={visibleItems}
            keyExtractor={(item) => String(item.id)}
            style={{ maxHeight: 320 }}
            ListEmptyComponent={
              <ThemedText color="muted" style={styles.empty}>
                Nenhum item nessa categoria.
              </ThemedText>
            }
            renderItem={({ item }) => (
              <Pressable onPress={() => setSelected(item)} style={styles.menuItemRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="default">{item.name}</ThemedText>
                  <ThemedText color="muted" type="small" numberOfLines={1}>
                    {item.description || item.sector_display}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold" color="gold">
                  R$ {item.price}
                </ThemedText>
              </Pressable>
            )}
          />
        </>
      )}
    </AppModal>
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
    gap: Spacing.two,
  },
  summary: {
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.five,
  },
  itemCard: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  itemCancelled: {
    opacity: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    padding: Spacing.three,
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  categoryRow: {
    flexGrow: 0,
    marginBottom: Spacing.two,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginRight: Spacing.two,
  },
  categoryChipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerColumn: {
    gap: Spacing.three,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    backgroundColor: Colors.dark,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: Colors.white,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
