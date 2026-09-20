import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  assignTicketToTable,
  callNextTicket,
  callTicket,
  cancelTicket,
  createQueueTicket,
  fetchQueue,
  finalizeTicket,
  openOrderForTicket,
  type PriorityCategory,
  type QueueTicket,
} from '@/api/queue';
import type { RestaurantTable } from '@/api/tables';
import { AppButton } from '@/components/app-button';
import { AppModal } from '@/components/app-modal';
import { StatusBadge } from '@/components/status-badge';
import { TablePickerModal } from '@/components/table-picker-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';

const PRIORITY_OPTIONS: { key: PriorityCategory; label: string }[] = [
  { key: 'NENHUMA', label: 'Sem prioridade' },
  { key: 'IDOSO_80', label: 'Idoso(a) 80+' },
  { key: 'IDOSO_60', label: 'Idoso(a) 60-79' },
  { key: 'PCD', label: 'PCD' },
  { key: 'GESTANTE', label: 'Gestante' },
  { key: 'LACTANTE', label: 'Lactante' },
  { key: 'COLO', label: 'Criança de colo' },
  { key: 'OBESIDADE', label: 'Obesidade' },
];

const OPEN_STATUSES = new Set(['AGUARDANDO', 'CHAMADO']);

export default function FilaScreen() {
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateVisible, setCreateVisible] = useState(false);
  const [assignTarget, setAssignTarget] = useState<QueueTicket | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const all = await fetchQueue();
      setTickets(all.filter((t) => OPEN_STATUSES.has(t.status)));
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

  async function handleCallNext() {
    try {
      await callNextTicket('all');
      await load(true);
    } catch (err: any) {
      Alert.alert('Fila', err?.response?.data?.detail ?? 'Não há senhas aguardando.');
    }
  }

  async function handleCallTicket(ticket: QueueTicket) {
    setBusyId(ticket.id);
    try {
      await callTicket(ticket.id);
      await load(true);
    } catch (err: any) {
      Alert.alert('Fila', err?.response?.data?.detail ?? 'Não foi possível chamar esta senha.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(ticket: QueueTicket) {
    Alert.alert('Cancelar senha', `Cancelar a senha ${ticket.code}?`, [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim, cancelar',
        style: 'destructive',
        onPress: async () => {
          setBusyId(ticket.id);
          try {
            await cancelTicket(ticket.id);
            await load(true);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  async function handleFinalize(ticket: QueueTicket) {
    setBusyId(ticket.id);
    try {
      await finalizeTicket(ticket.id);
      await load(true);
    } finally {
      setBusyId(null);
    }
  }

  async function handleOpenOrder(ticket: QueueTicket) {
    setBusyId(ticket.id);
    try {
      const order = await openOrderForTicket(ticket.id);
      router.push(`/pedidos/${order.id}`);
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir a comanda.');
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

  return (
    <ThemedView style={styles.container}>
      <View style={styles.toolbar}>
        <AppButton label="Chamar próxima" variant="gold" onPress={handleCallNext} style={{ flex: 1 }} />
        <AppButton label="+ Nova senha" onPress={() => setCreateVisible(true)} style={{ flex: 1 }} />
      </View>

      <FlatList
        data={tickets}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.gold} />
        }
        ListEmptyComponent={
          <ThemedText color="muted" style={styles.empty}>
            Nenhuma senha aguardando.
          </ThemedText>
        }
        renderItem={({ item }) => (
          <ThemedView card style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <ThemedText type="subtitle">{item.code}</ThemedText>
                <ThemedText color="muted" type="small">
                  {item.customer_name || 'Sem nome'} · {item.people_count} pessoa(s)
                </ThemedText>
              </View>
              <StatusBadge status={item.status} label={item.status_display} />
            </View>
            {item.is_priority && (
              <ThemedText type="small" style={{ color: Colors.gold }}>
                {item.priority_category_display}
              </ThemedText>
            )}
            <View style={styles.actions}>
              <AppButton
                label="Lançar pedido"
                variant="ghost"
                onPress={() => handleOpenOrder(item)}
                loading={busyId === item.id}
                style={styles.actionButton}
              />
              {item.status === 'AGUARDANDO' && (
                <AppButton
                  label="Chamar"
                  variant="gold"
                  onPress={() => handleCallTicket(item)}
                  loading={busyId === item.id}
                  style={styles.actionButton}
                />
              )}
              {item.status === 'CHAMADO' && (
                <AppButton
                  label="Destinar mesa"
                  variant="gold"
                  onPress={() => setAssignTarget(item)}
                  loading={busyId === item.id}
                  style={styles.actionButton}
                />
              )}
              {item.status === 'CHAMADO' && (
                <AppButton
                  label="Finalizar"
                  variant="ghost"
                  onPress={() => handleFinalize(item)}
                  loading={busyId === item.id}
                  style={styles.actionButton}
                />
              )}
              <AppButton
                label="Cancelar"
                variant="danger"
                onPress={() => handleCancel(item)}
                loading={busyId === item.id}
                style={styles.actionButton}
              />
            </View>
          </ThemedView>
        )}
      />

      <CreateTicketModal
        visible={isCreateVisible}
        onClose={() => setCreateVisible(false)}
        onCreated={() => {
          setCreateVisible(false);
          load(true);
        }}
      />

      <AssignTableModal
        ticket={assignTarget}
        onClose={() => setAssignTarget(null)}
        onAssigned={(orderId) => {
          setAssignTarget(null);
          load(true);
          if (orderId) router.push(`/pedidos/${orderId}`);
        }}
      />
    </ThemedView>
  );
}

function CreateTicketModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [peopleCount, setPeopleCount] = useState('1');
  const [priority, setPriority] = useState<PriorityCategory>('NENHUMA');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setCustomerName('');
      setPeopleCount('1');
      setPriority('NENHUMA');
    }
  }, [visible]);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await createQueueTicket({
        customer_name: customerName,
        people_count: Number(peopleCount) || 1,
        priority_category: priority,
      });
      onCreated();
    } catch {
      Alert.alert('Erro', 'Não foi possível emitir a senha.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppModal visible={visible} title="Nova senha" onClose={onClose}>
      <ThemedText type="label" color="muted">
        Nome do cliente
      </ThemedText>
      <TextInput
        value={customerName}
        onChangeText={setCustomerName}
        placeholder="Opcional"
        placeholderTextColor={Colors.muted}
        style={styles.textInput}
      />
      <ThemedText type="label" color="muted">
        Número de pessoas
      </ThemedText>
      <TextInput
        value={peopleCount}
        onChangeText={setPeopleCount}
        keyboardType="number-pad"
        selectTextOnFocus
        returnKeyType="done"
        style={styles.textInput}
      />
      <ThemedText type="label" color="muted">
        Prioridade
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {PRIORITY_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => setPriority(opt.key)}
            style={[styles.chip, priority === opt.key && styles.chipActive]}>
            <ThemedText type="small" color={priority === opt.key ? 'black' : 'white'}>
              {opt.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
      <AppButton label="Emitir senha" variant="gold" onPress={handleSubmit} loading={isSubmitting} />
    </AppModal>
  );
}

function AssignTableModal({
  ticket,
  onClose,
  onAssigned,
}: {
  ticket: QueueTicket | null;
  onClose: () => void;
  onAssigned: (orderId: number | null) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAssign(table: RestaurantTable) {
    if (!ticket) return;
    setIsSubmitting(true);
    try {
      const result = await assignTicketToTable(ticket.id, table.id, true);
      onAssigned(result.order_id);
    } catch {
      Alert.alert('Erro', 'Não foi possível destinar a mesa.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <TablePickerModal
      visible={!!ticket}
      title="Destinar mesa"
      onClose={onClose}
      onSelect={handleAssign}
      isSubmitting={isSubmitting}
    />
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
  toolbar: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  list: {
    padding: Spacing.three,
    paddingTop: 0,
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
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  actionButton: {
    flexGrow: 1,
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
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginRight: Spacing.two,
  },
  chipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
});
