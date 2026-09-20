import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';

import { fetchTables, type RestaurantTable } from '@/api/tables';
import { AppModal } from '@/components/app-modal';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

interface TablePickerModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSelect: (table: RestaurantTable) => void;
  isSubmitting?: boolean;
  /** Por padrão só mostra mesas livres; passe para incluir outras. */
  filter?: (table: RestaurantTable) => boolean;
}

export function TablePickerModal({
  visible,
  title,
  onClose,
  onSelect,
  isSubmitting,
  filter = (t) => t.status === 'LIVRE',
}: TablePickerModalProps) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setIsLoading(true);
    fetchTables()
      .then((all) => setTables(all.filter(filter)))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <AppModal visible={visible} title={title} onClose={onClose}>
      {isLoading ? (
        <ActivityIndicator color={Colors.gold} />
      ) : (
        <FlatList
          data={tables}
          keyExtractor={(item) => String(item.id)}
          style={{ maxHeight: 320 }}
          ListEmptyComponent={
            <ThemedText color="muted" style={styles.empty}>
              Nenhuma mesa livre.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => onSelect(item)} disabled={isSubmitting} style={styles.row}>
              <ThemedText>Mesa {item.number}</ThemedText>
              <ThemedText color="muted" type="small">
                {item.seats} lugares
              </ThemedText>
            </Pressable>
          )}
        />
      )}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  empty: {
    textAlign: 'center',
    marginTop: Spacing.five,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
