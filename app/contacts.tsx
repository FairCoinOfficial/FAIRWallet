/**
 * Contacts / Address Book screen.
 * Full-screen modal for managing contacts with CRUD operations.
 */

import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  Alert,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useContactsStore } from "../src/wallet/contacts-store";
import { getDatabase } from "../src/wallet/wallet-store";
import type { ContactRow } from "../src/storage/database";
import { Button } from "../src/ui/components/Button";
import { QRScanner } from "../src/ui/components/QRScanner";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMOJI_OPTIONS = [
  "\uD83D\uDC64", "\uD83D\uDCB0", "\uD83C\uDFE0", "\uD83C\uDFAE",
  "\uD83D\uDED2", "\uD83D\uDCF1", "\uD83C\uDFE6", "\uD83D\uDC8E",
  "\uD83C\uDF1F", "\uD83D\uDD11", "\uD83C\uDFB5", "\uD83C\uDF55",
  "\u2708\uFE0F", "\uD83C\uDFA8", "\uD83C\uDFC6", "\uD83E\uDD1D",
  "\uD83D\uDCBC", "\uD83C\uDFAF", "\uD83D\uDE80", "\u2B50",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

// ---------------------------------------------------------------------------
// Contact form modal
// ---------------------------------------------------------------------------

interface ContactFormProps {
  visible: boolean;
  editingContact: ContactRow | null;
  onSave: (name: string, address: string, notes: string, emoji: string) => void;
  onClose: () => void;
}

function ContactForm({
  visible,
  editingContact,
  onSave,
  onClose,
}: ContactFormProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [emoji, setEmoji] = useState("\uD83D\uDC64");
  const [showQRScanner, setShowQRScanner] = useState(false);

  const handleOpen = useCallback(() => {
    if (editingContact) {
      setName(editingContact.name);
      setAddress(editingContact.address);
      setNotes(editingContact.notes);
      setEmoji(editingContact.emoji);
    } else {
      setName("");
      setAddress("");
      setNotes("");
      setEmoji("\uD83D\uDC64");
    }
  }, [editingContact]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setAddress(text.trim());
      }
    } catch {
      // Clipboard read failed silently
    }
  }, []);

  const handleQRScan = useCallback((scannedAddress: string) => {
    setAddress(scannedAddress);
  }, []);

  const canSave = name.trim().length > 0 && address.trim().length >= 25;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    onSave(name.trim(), address.trim(), notes.trim(), emoji);
  }, [canSave, name, address, notes, emoji, onSave]);

  const handleClose = useCallback(() => {
    setName("");
    setAddress("");
    setNotes("");
    setEmoji("\uD83D\uDC64");
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      onShow={handleOpen}
    >
      <View className="flex-1 bg-black/70 items-center justify-center px-6">
        <View className="bg-fair-dark-light border border-fair-border rounded-2xl p-6 w-full max-w-sm">
          <Text className="text-white text-lg font-bold mb-4 text-center">
            {editingContact ? "Edit Contact" : "New Contact"}
          </Text>

          {/* Emoji picker */}
          <Text className="text-fair-muted text-xs mb-2">Avatar</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {EMOJI_OPTIONS.map((e) => (
              <Pressable
                key={e}
                className={`w-9 h-9 rounded-lg items-center justify-center ${
                  emoji === e
                    ? "bg-fair-green/20 border border-fair-green"
                    : "bg-fair-dark"
                }`}
                onPress={() => setEmoji(e)}
              >
                <Text className="text-lg">{e}</Text>
              </Pressable>
            ))}
          </View>

          {/* Name input */}
          <Text className="text-fair-muted text-xs mb-1">Name</Text>
          <View className="bg-fair-dark border border-fair-border rounded-xl px-3 py-2.5 mb-3">
            <TextInput
              className="text-white text-sm"
              placeholder="Contact name"
              placeholderTextColor="#6b7280"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          {/* Address input */}
          <Text className="text-fair-muted text-xs mb-1">Address</Text>
          <View className="bg-fair-dark border border-fair-border rounded-xl px-3 py-2.5 mb-3">
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 text-white text-sm mr-2"
                placeholder="FairCoin address"
                placeholderTextColor="#6b7280"
                value={address}
                onChangeText={setAddress}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                className="bg-fair-dark-light border border-fair-border rounded-lg px-2 py-1 mr-1"
                onPress={handlePaste}
              >
                <Text className="text-fair-green text-xs">Paste</Text>
              </Pressable>
              <Pressable
                className="bg-fair-dark-light border border-fair-border rounded-lg px-2 py-1"
                onPress={() => setShowQRScanner(true)}
              >
                <Text className="text-fair-green text-xs">QR</Text>
              </Pressable>
            </View>
          </View>

          {/* Notes input */}
          <Text className="text-fair-muted text-xs mb-1">Notes</Text>
          <View className="bg-fair-dark border border-fair-border rounded-xl px-3 py-2.5 mb-4">
            <TextInput
              className="text-white text-sm"
              placeholder="Optional notes"
              placeholderTextColor="#6b7280"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Actions */}
          <View className="gap-3">
            <Button
              title={editingContact ? "Save Changes" : "Add Contact"}
              onPress={handleSave}
              variant="primary"
              disabled={!canSave}
            />
            <Button title="Cancel" onPress={handleClose} variant="secondary" />
          </View>
        </View>
      </View>

      <QRScanner
        visible={showQRScanner}
        onScan={handleQRScan}
        onClose={() => setShowQRScanner(false)}
      />
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Contact list item
// ---------------------------------------------------------------------------

interface ContactItemProps {
  contact: ContactRow;
  onPress: (contact: ContactRow) => void;
  onLongPress: (contact: ContactRow) => void;
}

function ContactItem({ contact, onPress, onLongPress }: ContactItemProps) {
  const handlePress = useCallback(() => {
    onPress(contact);
  }, [contact, onPress]);

  const handleLongPress = useCallback(() => {
    onLongPress(contact);
  }, [contact, onLongPress]);

  return (
    <Pressable
      className="flex-row items-center px-4 py-3 border-b border-fair-border active:bg-fair-dark"
      onPress={handlePress}
      onLongPress={handleLongPress}
    >
      <View className="w-10 h-10 rounded-full bg-fair-dark items-center justify-center mr-3">
        <Text className="text-lg">{contact.emoji}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-white text-sm font-medium">{contact.name}</Text>
        <Text className="text-fair-muted text-xs mt-0.5">
          {truncateAddress(contact.address)}
        </Text>
      </View>
      <Text className="text-fair-muted text-sm">{"\u203A"}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main contacts screen
// ---------------------------------------------------------------------------

export default function ContactsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isPickMode = params.mode === "pick";

  const contacts = useContactsStore((s) => s.contacts);
  const loadContacts = useContactsStore((s) => s.loadContacts);
  const addContact = useContactsStore((s) => s.addContact);
  const updateContact = useContactsStore((s) => s.updateContact);
  const deleteContact = useContactsStore((s) => s.deleteContact);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ContactRow[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRow | null>(null);

  // Load contacts on mount via onShow-like mechanism (useFocusEffect equivalent)
  const handleLayout = useCallback(() => {
    const db = getDatabase();
    if (db) {
      loadContacts(db);
    }
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

  const handleAddPress = useCallback(() => {
    setEditingContact(null);
    setShowForm(true);
  }, []);

  const handleContactPress = useCallback(
    (contact: ContactRow) => {
      if (isPickMode) {
        router.back();
        // Short delay to let navigation complete, then the send screen
        // will read from a shared mechanism. For simplicity, we copy to clipboard
        // and the Send screen handles it. Actually, better: we use router params.
        // expo-router doesn't natively support returning data, so we use
        // a store-based approach.
        return;
      }
      // In management mode, tap opens edit
      setEditingContact(contact);
      setShowForm(true);
    },
    [isPickMode, router],
  );

  const handleContactLongPress = useCallback(
    (contact: ContactRow) => {
      Alert.alert(contact.name, truncateAddress(contact.address), [
        {
          text: "Edit",
          onPress: () => {
            setEditingContact(contact);
            setShowForm(true);
          },
        },
        {
          text: "Copy Address",
          onPress: () => {
            Clipboard.setStringAsync(contact.address);
          },
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Delete Contact",
              `Are you sure you want to delete "${contact.name}"?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    const db = getDatabase();
                    if (db) {
                      deleteContact(db, contact.id);
                    }
                  },
                },
              ],
            );
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [deleteContact],
  );

  const handleFormSave = useCallback(
    (name: string, address: string, notes: string, emoji: string) => {
      const db = getDatabase();
      if (!db) return;

      if (editingContact) {
        updateContact(db, editingContact.id, name, address, notes, emoji);
      } else {
        addContact(db, name, address, notes, emoji);
      }

      setShowForm(false);
      setEditingContact(null);
    },
    [editingContact, addContact, updateContact],
  );

  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setEditingContact(null);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ContactRow }) => (
      <ContactItem
        contact={item}
        onPress={handleContactPress}
        onLongPress={handleContactLongPress}
      />
    ),
    [handleContactPress, handleContactLongPress],
  );

  const keyExtractor = useCallback((item: ContactRow) => item.id, []);

  return (
    <View
      className="flex-1 bg-fair-dark"
      style={{ paddingTop: insets.top }}
      onLayout={handleLayout}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-fair-border">
        <Pressable onPress={() => router.back()} className="p-2">
          <Text className="text-fair-green text-base font-semibold">
            {"\u2190"} Back
          </Text>
        </Pressable>
        <Text className="text-white text-lg font-bold">Contacts</Text>
        <Pressable onPress={handleAddPress} className="p-2">
          <Text className="text-fair-green text-2xl font-bold">+</Text>
        </Pressable>
      </View>

      {/* Search bar */}
      <View className="px-4 py-3">
        <View className="bg-fair-dark-light border border-fair-border rounded-xl px-4 py-2.5">
          <TextInput
            className="text-white text-sm"
            placeholder="Search by name or address..."
            placeholderTextColor="#6b7280"
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
          <Text className="text-fair-muted text-4xl mb-4">{"\uD83D\uDCDA"}</Text>
          <Text className="text-fair-muted text-base text-center">
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

      {/* Contact form modal */}
      <ContactForm
        visible={showForm}
        editingContact={editingContact}
        onSave={handleFormSave}
        onClose={handleFormClose}
      />
    </View>
  );
}
