// Textos en inglés de zui por espacio de nombres: las constantes `*_LABELS` de cada componente. Es la referencia de
// claves de los demás idiomas (`pnpm locales` compara cada paquete con este) y el paquete que devuelve un idioma
// anidado al inglés.
import type { LocalePack } from "../core/locale";
import { ACTIVITY_LABELS } from "../core/activity";
import { DEFAULT_LABELS as AGENDA_LABELS } from "../core/agenda-view";
import { PERPETUAL_LABELS } from "../core/agenda-year";
import { AGENT_ANNOUNCE_LABELS } from "../core/agent-state";
import { AGENT_PLAN_LABELS, AGENT_STATUS_LABELS, AI_LABELS, ARTIFACT_LABELS, USAGE_METER_LABELS } from "../core/ai-widgets";
import { CAROUSEL_LABELS } from "../core/carousel";
import { CASCADER_LABELS } from "../core/cascader-widget";
import { CATEGORY_BAR_LABELS } from "../core/category-bar";
import { CHART_LABELS } from "../core/chart-parts";
import { ARRIVAL_LABELS, TYPING_LABELS } from "../core/chat-group";
import { CHAT_LABELS } from "../core/chat-tree";
import { CALL_CARD_LABELS, PINNED_BAR_LABELS } from "../core/chat-widgets";
import { WORLD_CLOCK_LABELS } from "../core/clock-widget";
import { CODE_VIEWER_LABELS } from "../core/code-viewer-widget";
import { COLOR_PICKER_LABELS } from "../core/color-widget";
import { COMPOSER_LABELS, PROMPT_INPUT_LABELS } from "../core/composer-widget";
import { CONVERSATION_LIST_LABELS } from "../core/conversation-list-widget";
import { COUNTDOWN_LABELS } from "../core/countdown-widget";
import { IMAGE_CROPPER_LABELS } from "../core/cropper-widget";
import { FUNNEL_LABELS, PROGRESS_GOAL_LABELS } from "../core/dashboard-trees";
import { REORDER_LABELS as COLUMN_REORDER_LABELS } from "../core/datagrid-reorder";
import { DATE_TIME_RANGE_LABELS } from "../core/datetime-range";
import { DELIVERY_LABELS } from "../core/delivery";
import { DIFF_VIEWER_LABELS } from "../core/diff-widget";
import { DURATION_FIELD_LABELS } from "../core/duration-widget";
import { EMOJI_PICKER_LABELS } from "../core/emoji-picker-widget";
import { FILTER_BAR_LABELS } from "../core/filter-bar-widget";
import { FREEBUSY_LABELS } from "../core/freebusy-widget";
import { GAUGE_LABELS } from "../core/gauge";
import { GRAPH_LABELS } from "../core/graph";
import { GRID_LABELS } from "../core/grid-layout";
import { HABIT_LABELS } from "../core/habit-widget";
import { HEATMAP_LABELS } from "../core/heatmap-widget";
import { KANBAN_LABELS } from "../core/kanban";
import { LIGHTBOX_LABELS } from "../core/lightbox-runtime";
import { LOG_CONSOLE_LABELS } from "../core/log-widget";
import { MEMBER_LIST_LABELS } from "../core/member-list-widget";
import { MESSAGE_LIST_LABELS } from "../core/message-list-widget";
import { DELTA_LABELS, METRIC_CARD_LABELS } from "../core/metric";
import { NODE_CANVAS_LABELS } from "../core/node-view";
import { NOTIFICATION_CENTER_LABELS } from "../core/notification-center-widget";
import { ACCOUNT_MENU_LABELS, PROFILE_LABELS, SETTING_ROW_LABELS } from "../core/profile";
import { QRCODE_LABELS } from "../core/qr-widget";
import { QUARTER_LABELS } from "../core/quarter-widget";
import { REORDER_LABELS } from "../core/reorder";
import { REVIEW_CARD_LABELS, REVIEW_SUMMARY_LABELS } from "../core/reviews";
import { SEGMENT_LABELS } from "../core/segments";
import { SHORTCUT_LABELS } from "../core/shortcut-widget";
import { SIGNATURE_LABELS } from "../core/signature-widget";
import { SLOT_LABELS } from "../core/slots-widget";
import { SPARKLINE_LABELS } from "../core/sparkline";
import { STORIES_LABELS } from "../core/stories";
import { TERMINAL_LABELS } from "../core/terminal-widget";
import { TIME_RANGE_LABELS } from "../core/time-range";
import { TIMELINE_LABELS } from "../core/timeline-view";
import { TRACKER_LABELS } from "../core/tracker";
import { TRANSFER_LABELS } from "../core/transfer-widget";
import { TREE_SELECT_LABELS } from "../core/tree-select-widget";
import { TREE_DRAG_LABELS } from "../core/tree";
import { PRESENCE_LABELS } from "../core/user-presence";

export const messages = {
  accountMenu: ACCOUNT_MENU_LABELS,
  activityFeed: ACTIVITY_LABELS,
  agenda: AGENDA_LABELS,
  agentAnnounce: AGENT_ANNOUNCE_LABELS,
  agentPlan: AGENT_PLAN_LABELS,
  agentStatus: AGENT_STATUS_LABELS,
  ai: AI_LABELS,
  arrival: ARRIVAL_LABELS,
  artifact: ARTIFACT_LABELS,
  callCard: CALL_CARD_LABELS,
  carousel: CAROUSEL_LABELS,
  cascader: CASCADER_LABELS,
  categoryBar: CATEGORY_BAR_LABELS,
  chart: CHART_LABELS,
  chat: CHAT_LABELS,
  codeViewer: CODE_VIEWER_LABELS,
  colorPicker: COLOR_PICKER_LABELS,
  columnReorder: COLUMN_REORDER_LABELS,
  composer: COMPOSER_LABELS,
  conversationList: CONVERSATION_LIST_LABELS,
  countdown: COUNTDOWN_LABELS,
  dashboardGrid: GRID_LABELS,
  dateTimeRange: DATE_TIME_RANGE_LABELS,
  delivery: DELIVERY_LABELS,
  delta: DELTA_LABELS,
  diffViewer: DIFF_VIEWER_LABELS,
  durationField: DURATION_FIELD_LABELS,
  emojiPicker: EMOJI_PICKER_LABELS,
  filterBar: FILTER_BAR_LABELS,
  freeBusy: FREEBUSY_LABELS,
  funnel: FUNNEL_LABELS,
  gauge: GAUGE_LABELS,
  graph: GRAPH_LABELS,
  habit: HABIT_LABELS,
  heatmap: HEATMAP_LABELS,
  imageCropper: IMAGE_CROPPER_LABELS,
  kanban: KANBAN_LABELS,
  lightbox: LIGHTBOX_LABELS,
  logConsole: LOG_CONSOLE_LABELS,
  memberList: MEMBER_LIST_LABELS,
  messageList: MESSAGE_LIST_LABELS,
  metricCard: METRIC_CARD_LABELS,
  nodeCanvas: NODE_CANVAS_LABELS,
  notificationCenter: NOTIFICATION_CENTER_LABELS,
  perpetual: PERPETUAL_LABELS,
  pinnedBar: PINNED_BAR_LABELS,
  presence: PRESENCE_LABELS,
  profile: PROFILE_LABELS,
  progressGoal: PROGRESS_GOAL_LABELS,
  promptInput: PROMPT_INPUT_LABELS,
  qrCode: QRCODE_LABELS,
  quarter: QUARTER_LABELS,
  reorder: REORDER_LABELS,
  reviewCard: REVIEW_CARD_LABELS,
  reviewSummary: REVIEW_SUMMARY_LABELS,
  segment: SEGMENT_LABELS,
  settingRow: SETTING_ROW_LABELS,
  shortcut: SHORTCUT_LABELS,
  signature: SIGNATURE_LABELS,
  slots: SLOT_LABELS,
  sparkline: SPARKLINE_LABELS,
  stories: STORIES_LABELS,
  terminal: TERMINAL_LABELS,
  timeRange: TIME_RANGE_LABELS,
  timeline: TIMELINE_LABELS,
  tracker: TRACKER_LABELS,
  transfer: TRANSFER_LABELS,
  treeDrag: TREE_DRAG_LABELS,
  treeSelect: TREE_SELECT_LABELS,
  typing: TYPING_LABELS,
  usageMeter: USAGE_METER_LABELS,
  worldClock: WORLD_CLOCK_LABELS,
};

/** Claves y anidamiento de los textos de zui: lo que tiene que cubrir un paquete de idioma. */
export type ZuiMessages = typeof messages;

const en: LocalePack<ZuiMessages> = { id: "en", messages };
export default en;
