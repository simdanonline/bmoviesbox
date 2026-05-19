import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import { useUserData } from "../context/UserDataContext";
import { WatchPlanItem } from "../types/app";

interface TitlePlanningPanelProps {
  titleUrl: string;
  detailSlug?: string | null;
  title: string;
  isSeries: boolean;
  thumbnail?: string | null;
}

type QuickPlanKey = "tonight" | "tomorrow" | "weekend";

const QUICK_PLAN_LABELS: Record<QuickPlanKey, string> = {
  tonight: "Tonight",
  tomorrow: "Tomorrow",
  weekend: "Weekend",
};

function createPlanDate(key: QuickPlanKey): string {
  const date = new Date();
  date.setSeconds(0, 0);

  if (key === "tomorrow") {
    date.setDate(date.getDate() + 1);
  }

  if (key === "weekend") {
    const day = date.getDay();
    const daysUntilFriday = (5 - day + 7) % 7 || 7;
    date.setDate(date.getDate() + daysUntilFriday);
  }

  date.setHours(20, 0, 0, 0);
  if (key === "tonight" && date.getTime() < Date.now()) {
    date.setDate(date.getDate() + 1);
  }

  return date.toISOString();
}

function formatPlanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unscheduled";
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TitlePlanningPanel({
  titleUrl,
  detailSlug,
  title,
  isSeries,
  thumbnail,
}: TitlePlanningPanelProps) {
  const {
    addWatchPlan,
    updateWatchPlan,
    removeWatchPlan,
    getPlansForTitle,
    getTitleNote,
    saveTitleNote,
    deleteTitleNote,
  } = useUserData();

  const existingNote = getTitleNote(titleUrl);
  const plans = getPlansForTitle(titleUrl);
  const activePlans = useMemo(
    () => plans.filter((plan) => plan.status === "planned"),
    [plans],
  );

  const [selectedQuickPlan, setSelectedQuickPlan] =
    useState<QuickPlanKey>("tonight");
  const [planNote, setPlanNote] = useState("");
  const [noteBody, setNoteBody] = useState(existingNote?.body ?? "");

  useEffect(() => {
    setNoteBody(existingNote?.body ?? "");
  }, [existingNote?.updatedAt, titleUrl]);

  const handleAddPlan = () => {
    addWatchPlan({
      titleUrl,
      detailSlug,
      title,
      isSeries,
      thumbnail,
      plannedFor: createPlanDate(selectedQuickPlan),
      note: planNote.trim(),
    });
    setPlanNote("");
    Alert.alert("Added to Planner", `${title} is on your watch plan.`);
  };

  const handleSaveNote = () => {
    saveTitleNote({
      titleUrl,
      title,
      isSeries,
      thumbnail,
      body: noteBody,
    });
    Alert.alert(noteBody.trim() ? "Note Saved" : "Note Cleared");
  };

  const handleDeleteNote = () => {
    deleteTitleNote(titleUrl);
    setNoteBody("");
  };

  const renderPlan = (plan: WatchPlanItem) => (
    <View key={plan.id} style={panelStyles.planRow}>
      <View style={panelStyles.planInfo}>
        <Text style={panelStyles.planDate}>
          {formatPlanDate(plan.plannedFor)}
        </Text>
        {plan.note ? (
          <Text style={panelStyles.planNote} numberOfLines={2}>
            {plan.note}
          </Text>
        ) : null}
      </View>
      {plan.status === "planned" ? (
        <TouchableOpacity
          style={panelStyles.iconButton}
          onPress={() => updateWatchPlan(plan.id, { status: "done" })}
        >
          <FontAwesome name="check" size={14} color="#2ecc71" />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        style={panelStyles.iconButton}
        onPress={() => removeWatchPlan(plan.id)}
      >
        <FontAwesome name="trash-o" size={14} color="#888" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={panelStyles.container}>
      <View style={panelStyles.headerRow}>
        <View>
          <Text style={panelStyles.sectionTitle}>My Plan</Text>
          <Text style={panelStyles.sectionSubtext}>
            {activePlans.length > 0
              ? `${activePlans.length} upcoming plan${
                  activePlans.length === 1 ? "" : "s"
                }`
              : "Schedule this title"}
          </Text>
        </View>
        <FontAwesome name="calendar-plus-o" size={22} color="#e74c3c" />
      </View>

      <View style={panelStyles.quickRow}>
        {(Object.keys(QUICK_PLAN_LABELS) as QuickPlanKey[]).map((key) => {
          const isActive = selectedQuickPlan === key;
          return (
            <TouchableOpacity
              key={key}
              style={[
                panelStyles.quickChip,
                isActive && panelStyles.quickChipActive,
              ]}
              onPress={() => setSelectedQuickPlan(key)}
            >
              <Text
                style={[
                  panelStyles.quickText,
                  isActive && panelStyles.quickTextActive,
                ]}
              >
                {QUICK_PLAN_LABELS[key]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TextInput
        value={planNote}
        onChangeText={setPlanNote}
        placeholder="Add a reason or viewing note"
        placeholderTextColor="#777"
        style={panelStyles.input}
      />

      <TouchableOpacity
        style={panelStyles.primaryButton}
        onPress={handleAddPlan}
      >
        <Text style={panelStyles.primaryButtonText}>Add to Planner</Text>
      </TouchableOpacity>

      {plans.length > 0 && (
        <View style={panelStyles.planList}>
          {plans.slice(0, 3).map(renderPlan)}
        </View>
      )}

      <View style={panelStyles.divider} />

      <View style={panelStyles.headerRow}>
        <View>
          <Text style={panelStyles.sectionTitle}>Private Notes</Text>
          <Text style={panelStyles.sectionSubtext}>
            {existingNote ? "Updated in your journal" : "Keep your own take"}
          </Text>
        </View>
        <FontAwesome name="pencil-square-o" size={22} color="#e74c3c" />
      </View>

      <TextInput
        value={noteBody}
        onChangeText={setNoteBody}
        placeholder="Write what to remember about this title"
        placeholderTextColor="#777"
        multiline
        textAlignVertical="top"
        style={[panelStyles.input, panelStyles.noteInput]}
      />

      <View style={panelStyles.noteActions}>
        {existingNote && (
          <TouchableOpacity
            style={panelStyles.secondaryButton}
            onPress={handleDeleteNote}
          >
            <Text style={panelStyles.secondaryButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[panelStyles.primaryButton, panelStyles.noteSaveButton]}
          onPress={handleSaveNote}
        >
          <Text style={panelStyles.primaryButtonText}>Save Note</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const panelStyles = StyleSheet.create({
  container: {
    backgroundColor: "#111",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    padding: 14,
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  sectionSubtext: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  quickChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
  },
  quickChipActive: {
    backgroundColor: "#e74c3c",
    borderColor: "#e74c3c",
  },
  quickText: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: "700",
  },
  quickTextActive: {
    color: "#fff",
  },
  input: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    color: "#fff",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  noteInput: {
    minHeight: 96,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: "#e74c3c",
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  planList: {
    marginTop: 12,
    gap: 8,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  planInfo: {
    flex: 1,
  },
  planDate: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  planNote: {
    color: "#aaa",
    fontSize: 12,
    marginTop: 2,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#242424",
  },
  divider: {
    height: 1,
    backgroundColor: "#2a2a2a",
    marginVertical: 16,
  },
  noteActions: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: "#242424",
  },
  secondaryButtonText: {
    color: "#ddd",
    fontSize: 14,
    fontWeight: "700",
  },
  noteSaveButton: {
    flex: 1,
  },
});
