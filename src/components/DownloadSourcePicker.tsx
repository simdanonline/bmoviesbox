import React from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import type { ResolvedStream } from "../services/MovieAPI";
import { getSourceLanguageLabel } from "../utils/sourceLanguage";

interface DownloadSourcePickerProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  sources: ResolvedStream[];
  activeUrl?: string | null;
  onSelect: (source: ResolvedStream) => void;
  onClose: () => void;
}

export default function DownloadSourcePicker({
  visible,
  title,
  subtitle,
  sources,
  activeUrl,
  onSelect,
  onClose,
}: DownloadSourcePickerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={pickerStyles.backdrop}>
        <View style={pickerStyles.panel}>
          <View style={pickerStyles.header}>
            <View style={pickerStyles.headerTextWrap}>
              <Text style={pickerStyles.title}>Choose download source</Text>
              <Text style={pickerStyles.subtitle} numberOfLines={1}>
                {subtitle ?? title}
              </Text>
            </View>
            <TouchableOpacity
              style={pickerStyles.closeButton}
              onPress={onClose}
            >
              <FontAwesome name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={pickerStyles.list}
            contentContainerStyle={pickerStyles.listContent}
            showsVerticalScrollIndicator
          >
            {sources.map((source, index) => {
              const active = activeUrl === source.url;
              const languageLabel = getSourceLanguageLabel(source);
              return (
                <TouchableOpacity
                  key={`${source.url}-${index}`}
                  style={[
                    pickerStyles.row,
                    index === 0 && pickerStyles.recommendedRow,
                    active && pickerStyles.rowDisabled,
                  ]}
                  onPress={() => onSelect(source)}
                  disabled={active}
                >
                  <View style={pickerStyles.rowTop}>
                    <Text style={pickerStyles.quality}>{source.quality}</Text>
                    {index === 0 && (
                      <View style={pickerStyles.badge}>
                        <Text style={pickerStyles.badgeText}>Recommended</Text>
                      </View>
                    )}
                    {active && (
                      <ActivityIndicator
                        size="small"
                        color="#e74c3c"
                        style={pickerStyles.spinner}
                      />
                    )}
                  </View>
                  <Text style={pickerStyles.name} numberOfLines={1}>
                    {source.name || source.title || source.source}
                  </Text>
                  <View style={pickerStyles.metaRow}>
                    <Text style={pickerStyles.meta} numberOfLines={1}>
                      {formatSize(source.sizeBytes)}
                    </Text>
                    <Text style={pickerStyles.metaDot}>•</Text>
                    <Text style={pickerStyles.meta} numberOfLines={1}>
                      {source.type.toUpperCase()}
                    </Text>
                    {languageLabel && (
                      <>
                        <Text style={pickerStyles.metaDot}>•</Text>
                        <Text style={pickerStyles.meta} numberOfLines={1}>
                          {languageLabel}
                        </Text>
                      </>
                    )}
                    {source.seeders != null && (
                      <>
                        <Text style={pickerStyles.metaDot}>•</Text>
                        <Text style={pickerStyles.meta} numberOfLines={1}>
                          {source.seeders} seeders
                        </Text>
                      </>
                    )}
                    {source.rdCached && (
                      <>
                        <Text style={pickerStyles.metaDot}>•</Text>
                        <Text style={pickerStyles.meta} numberOfLines={1}>
                          cached
                        </Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function formatSize(bytes?: number): string {
  if (!bytes) return "Unknown size";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

const pickerStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center",
    padding: 20,
  },
  panel: {
    maxHeight: "78%",
    backgroundColor: "#151515",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2b2b2b",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  title: { color: "#fff", fontSize: 17, fontWeight: "700" },
  subtitle: { color: "#aaa", fontSize: 12, marginTop: 3 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#242424",
    marginLeft: 12,
  },
  list: { flexGrow: 0 },
  listContent: { padding: 12 },
  row: {
    backgroundColor: "#1f1f1f",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#303030",
    padding: 12,
    marginBottom: 10,
  },
  recommendedRow: { borderColor: "#e74c3c" },
  rowDisabled: { opacity: 0.65 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    minHeight: 22,
  },
  quality: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    marginRight: 8,
  },
  badge: {
    backgroundColor: "#e74c3c",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  spinner: { marginLeft: "auto" },
  name: { color: "#eee", fontSize: 13, marginBottom: 7 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  meta: { color: "#aaa", fontSize: 12, maxWidth: 210 },
  metaDot: { color: "#666", marginHorizontal: 6 },
});
