/**
 * Contact picker modal for selecting a contact's address.
 * Used in the Send screen to quickly fill an address from the address book.
 */

import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, Modal, FlatList } from "react-native";
import { useContactsStore } from "../../wallet/contacts-store";
import { getDatabase } from "../../wallet/wallet-store";
import type { ContactRow } from "../../storage/database";
import { useTheme } from "@oxyhq/bloom";

interface ContactPickerProps {
  visible: boolean;
  onSelect: (address: string) => void;
  onClose: () => void;
}

function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

function ContactPickerItem({
  contact,
  onPress,
}: {
  contact: ContactRow;
  onPress: (address: string) => void;
}) {
  const handlePress = useCallback(() => {
    onPress(contact.address);
  }, [contact.address, onPress]);

  return (
    <Pressable
      className="flex-row items-center px-4 py-3 border-b border-border active:bg-background"
      onPress={handlePress}
    >
      <View className="w-10 h-10 rounded-full bg-background items-center justify-center mr-3">
        <Text className="text-lg">{contact.emoji}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-white text-sm font-medium">{contact.name}</Text>
        <Text className="text-muted-foreground text-xs mt-0.5">
          {truncateAddress(contact.address)}
        </Text>
      </View>
    </Pressable>
  );
}

export function ContactPicker({
  visible,
  onSelect,
  onClose,
}: ContactPickerProps) {
  const contacts = useContactsStore((s) => s.contacts);
  const loadContacts = useContactsStore((s) => s.loadContacts);
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ContactRow[] | null>(null);

  const handleOpen = useCallback(() => {
    const db = getDatabase();
    if (db) {
      loadContacts(db);
    }
    setSearchQuery("");
    setSearchResults(null);
  }, [loadContacts]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (query.trim() === "") {
        setSearchResults(null);
        return;
      }
      const db = getDatabase();
      if (db) {
        db.searchContacts(query.trim()).then(setSearchResults);
      }
    },
    [],
  );

  const displayContacts = useMemo(
    () => searchResults ?? contacts,
    [searchResults, contacts],
  );

  const handleSelect = useCallback(
    (address: string) => {
      onSelect(address);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleClose = useCallback(() => {
    setSearchQuery("");
    setSearchResults(null);
    onClose();
  }, [onClose]);

  const renderItem = useCallback(
    ({ item }: { item: ContactRow }) => (
      <ContactPickerItem contact={item} onPress={handleSelect} />
    ),
    [handleSelect],
  );

  const keyExtractor = useCallback((item: ContactRow) => item.id, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      onShow={handleOpen}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="pt-14 pb-3 px-6 flex-row items-center justify-between bg-background border-b border-border">
          <Text className="text-white text-lg font-bold">Pick Contact</Text>
          <Pressable onPress={handleClose} className="p-2">
            <Text className="text-primary text-base font-semibold">
              Close
            </Text>
          </Pressable>
        </View>

        {/* Search */}
        <View className="px-4 py-3">
          <View className="bg-surface border border-border rounded-xl px-4 py-2.5">
            <TextInput
              className="text-white text-sm"
              placeholder="Search contacts..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Contact list */}
        {displayContacts.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-muted-foreground text-base text-center">
              {searchQuery
                ? "No contacts match your search"
                : "No contacts yet. Add one to get started."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={displayContacts}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            className="flex-1"
            contentContainerClassName="pb-8"
          />
        )}
      </View>
    </Modal>
  );
}
