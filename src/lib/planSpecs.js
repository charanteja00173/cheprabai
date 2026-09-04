export const PLAN_IDS = ["free", "pro", "enterprise"];

export const PLAN_META = {
  free: { label: "Free", color: "#94a3b8", desc: "Basic collaboration for small groups" },
  pro: { label: "Pro", color: "#818cf8", desc: "Advanced features for growing teams" },
  enterprise: { label: "Enterprise", color: "#f59e0b", desc: "Everything unlocked, built for scale" },
};

export const PLAN_LIMIT_LABELS = {
  maxParticipants: "Participants",
  maxRooms: "Rooms",
  maxFileSize: "File size (MB)",
  maxFileSharing: "File sharing",
  maxCallDuration: "Call duration (min)",
};

export const planLimitValue = (v) => {
  if (v === -1 || v == null) return "Unlimited";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return v;
};

export const FEATURE_GROUPS = [
  {
    label: "Calls & Media",
    features: [
      { key: "voiceCalls", label: "Voice Calls", desc: "Audio call functionality" },
      { key: "videoCalls", label: "Video Calls", desc: "Video call functionality" },
      { key: "screenSharing", label: "Screen Sharing", desc: "Share screen during calls" },
      { key: "meetingRecording", label: "Meeting Recording", desc: "Record live calls" },
      { key: "handRaise", label: "Hand Raise", desc: "Raise hand during calls" },
    ],
  },
  {
    label: "Messaging",
    features: [
      { key: "reactions", label: "Reactions", desc: "React with emojis" },
      { key: "messageEditing", label: "Message Editing", desc: "Edit sent messages" },
      { key: "messageSearch", label: "Message Search", desc: "Search message history" },
      { key: "messageForwarding", label: "Forwarding", desc: "Forward messages" },
      { key: "pinnedMessages", label: "Pinned Messages", desc: "Pin important messages" },
      { key: "ephemeralMessages", label: "Ephemeral Messages", desc: "Disappearing messages" },
      { key: "typingIndicators", label: "Typing Indicators", desc: "Show typing status" },
      { key: "scheduledMessages", label: "Scheduled Messages", desc: "Schedule for later" },
    ],
  },
  {
    label: "Media & Files",
    features: [
      { key: "fileSharing", label: "File Sharing", desc: "Upload and share files" },
      { key: "voiceRecordings", label: "Voice Recordings", desc: "Send voice notes" },
      { key: "giphySearch", label: "GIPHY Search", desc: "Search and send GIFs" },
      { key: "linkPreviews", label: "Link Previews", desc: "Preview shared links" },
      { key: "bookmarks", label: "Bookmarks", desc: "Save messages" },
    ],
  },
  {
    label: "Collaboration",
    features: [
      { key: "whiteboard", label: "Whiteboard", desc: "Shared drawing board" },
      { key: "polls", label: "Polls", desc: "Create and vote on polls" },
    ],
  },
  {
    label: "Platform",
    features: [
      { key: "profiles", label: "User Profiles", desc: "Display names and avatars" },
      { key: "stealthMode", label: "Stealth Mode", desc: "Anonymous joining" },
      { key: "themes", label: "Theme Switching", desc: "Change chat themes" },
      { key: "keyboardShortcuts", label: "Keyboard Shortcuts", desc: "Shortcuts help panel" },
      { key: "aiAssistant", label: "AI Assistant", desc: "AnonChatAI in-chat copilot" },
    ],
  },
];

const ALL_FEATURE_KEYS = FEATURE_GROUPS.flatMap((g) => g.features.map((f) => f.key));

const FREE_FEATURES = [
  "voiceCalls",
  "videoCalls",
  "screenSharing",
  "reactions",
  "messageEditing",
  "messageForwarding",
  "typingIndicators",
  "fileSharing",
  "voiceRecordings",
  "linkPreviews",
  "profiles",
  "themes",
  "keyboardShortcuts",
];

const PRO_EXTRA_FEATURES = [
  "handRaise",
  "messageSearch",
  "pinnedMessages",
  "scheduledMessages",
  "giphySearch",
  "bookmarks",
  "polls",
  "aiAssistant",
];

const PLAN_INCLUSIONS = {
  free: new Set(FREE_FEATURES),
  pro: new Set([...FREE_FEATURES, ...PRO_EXTRA_FEATURES]),
  enterprise: new Set(ALL_FEATURE_KEYS),
};

export const planIncludes = (planId, featureKey) =>
  Boolean(PLAN_INCLUSIONS[planId]?.has(featureKey));

export const planLimitRows = (planId, limits) =>
  Object.entries(limits || {}).map(([key, value]) => ({
    key,
    label: PLAN_LIMIT_LABELS[key] || key,
    value: planLimitValue(value),
  }));