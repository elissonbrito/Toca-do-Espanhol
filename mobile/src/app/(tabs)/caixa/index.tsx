import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import {
  closeRegister,
  fetchCurrentRegister,
  fetchPendingOrders,
  openRegister,
  registerPayment,
  type CashRegisterSession,
  type PaymentMethod,
} from '@/api/cash';
import type { Order } from '@/api/orders';
import { AppButton } from '@/components/app-button';
import { AppModal } from '@/components/app-modal';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';

const PAYMENT_METHODS: { key: PaymentMethod; label: string }[] = [
  { key: 'DINHEIRO', label: 'Dinheiro' },
  { key: 'PIX', label: 'PIX' },
  { key: 'DEBITO', label: 'Débito' },
  { key: 'CREDITO', label: 'Crédito' },
];

export default function CaixaScreen() {
  const [register, setRegister] = useState<CashRegisterSession | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOpenModalVisible, setOpenModalVisible] = useState(false);
  const [isCloseModalVisible, setCloseModalVisible] = useState(false);
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [reg, pending] = await Promise.all([fetchCurrentRegister(), fetchPendingOrders()]);
      setRegister(reg);
      setOrders(pending);
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
      <ThemedView card style={styles.registerCard}>
        {register ? (
          <>
            <View style={styles.registerHeader}>
              <ThemedText type="subtitle">Caixa #{register.id}</ThemedText>
              <StatusBadge status={register.status} label={register.status_display} />
            </View>
            <ThemedText color="muted" type="small">
              Aberto por {register.opened_by_name} · valor inicial R$ {register.initial_amount}
            </ThemedText>
            <AppButton label="Fechar caixa" variant="danger" onPress={() => setCloseModalVisible(true)} />
          </>
        ) : (
          <>
            <ThemedText color="muted">Nenhum caixa aberto.</ThemedText>
            <AppButton label="Abrir caixa" variant="gold" onPress={() => setOpenModalVisible(true)} />
          </>
        )}
      </ThemedView>

      <ThemedText type="label" color="muted" style={styles.sectionLabel}>
        Contas aguardando baixa
      </ThemedText>

      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.gold} />
        }
        ListEmptyComponent={
          <ThemedText color="muted" style={styles.empty}>
            Nenhuma conta aguardando pagamento.
          </ThemedText>
        }
        renderItem={({ item }) => (
          <ThemedView card style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <ThemedText type="subtitle">
                {item.table ? `Mesa ${item.table.number}` : `Comanda #${item.id}`}
              </ThemedText>
              <ThemedText type="subtitle" color="gold">
                R$ {item.total_amount}
              </ThemedText>
            </View>
            <ThemedText color="muted" type="small">
              {item.items.filter((i) => i.status !== 'CANCELADO').length} item(ns) · {item.people_count} pessoa(s)
            </ThemedText>
            <AppButton
              label="Registrar pagamento"
              variant="gold"
              onPress={() => setPayingOrder(item)}
              disabled={!register}
            />
            {!register && (
              <ThemedText type="small" style={{ color: Colors.redLight }}>
                Abra o caixa antes de registrar pagamentos.
              </ThemedText>
            )}
          </ThemedView>
        )}
      />

      <OpenRegisterModal
        visible={isOpenModalVisible}
        onClose={() => setOpenModalVisible(false)}
        onOpened={() => {
          setOpenModalVisible(false);
          load(true);
        }}
      />

      {register && (
        <CloseRegisterModal
          visible={isCloseModalVisible}
          register={register}
          onClose={() => setCloseModalVisible(false)}
          onClosed={() => {
            setCloseModalVisible(false);
            load(true);
          }}
        />
      )}

      <PaymentModal
        order={payingOrder}
        onClose={() => setPayingOrder(null)}
        onPaid={() => {
          setPayingOrder(null);
          load(true);
        }}
      />
    </ThemedView>
  );
}

function OpenRegisterModal({
  visible,
  onClose,
  onOpened,
}: {
  visible: boolean;
  onClose: () => void;
  onOpened: () => void;
}) {
  const [initialAmount, setInitialAmount] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setInitialAmount('0');
  }, [visible]);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await openRegister({ initial_amount: Number(initialAmount.replace(',', '.')) || 0 });
      onOpened();
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir o caixa.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppModal visible={visible} title="Abrir caixa" onClose={onClose}>
      <ThemedText type="label" color="muted">
        Valor inicial (R$)
      </ThemedText>
      <TextInput
        value={initialAmount}
        onChangeText={setInitialAmount}
        keyboardType="decimal-pad"
        selectTextOnFocus
        style={styles.textInput}
      />
      <AppButton label="Abrir caixa" variant="gold" onPress={handleSubmit} loading={isSubmitting} />
    </AppModal>
  );
}

function CloseRegisterModal({
  visible,
  register,
  onClose,
  onClosed,
}: {
  visible: boolean;
  register: CashRegisterSession;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [finalAmount, setFinalAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setFinalAmount('');
  }, [visible]);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await closeRegister(register.id, { final_amount: Number(finalAmount.replace(',', '.')) || 0 });
      onClosed();
    } catch {
      Alert.alert('Erro', 'Não foi possível fechar o caixa.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppModal visible={visible} title="Fechar caixa" onClose={onClose}>
      <ThemedText color="muted" type="small">
        Valor inicial: R$ {register.initial_amount}
      </ThemedText>
      <ThemedText type="label" color="muted">
        Valor final em caixa (R$)
      </ThemedText>
      <TextInput
        value={finalAmount}
        onChangeText={setFinalAmount}
        keyboardType="decimal-pad"
        selectTextOnFocus
        placeholder="0,00"
        placeholderTextColor={Colors.muted}
        style={styles.textInput}
      />
      <AppButton label="Confirmar fechamento" variant="danger" onPress={handleSubmit} loading={isSubmitting} />
    </AppModal>
  );
}

function PaymentModal({
  order,
  onClose,
  onPaid,
}: {
  order: Order | null;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('DINHEIRO');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (order) setAmount(order.total_amount);
  }, [order]);

  async function handleSubmit() {
    if (!order) return;
    setIsSubmitting(true);
    try {
      await registerPayment({
        order: order.id,
        amount: Number(amount.replace(',', '.')) || 0,
        payment_method: method,
      });
      onPaid();
    } catch (err: any) {
      Alert.alert('Erro', err?.response?.data?.detail ?? 'Não foi possível registrar o pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppModal visible={!!order} title="Registrar pagamento" onClose={onClose}>
      <ThemedText type="label" color="muted">
        Valor (R$)
      </ThemedText>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        selectTextOnFocus
        style={styles.textInput}
      />
      <ThemedText type="label" color="muted">
        Forma de pagamento
      </ThemedText>
      <View style={styles.methodRow}>
        {PAYMENT_METHODS.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => setMethod(m.key)}
            style={[styles.methodChip, method === m.key && styles.methodChipActive]}>
            <ThemedText type="small" color={method === m.key ? 'black' : 'white'}>
              {m.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      <AppButton label="Confirmar pagamento" variant="gold" onPress={handleSubmit} loading={isSubmitting} />
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
  registerCard: {
    margin: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  registerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.one,
  },
  list: {
    padding: Spacing.three,
    paddingTop: 0,
    gap: Spacing.two,
  },
  orderCard: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.six,
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
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  methodChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  methodChipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
});
