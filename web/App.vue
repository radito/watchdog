<script setup>
import { computed, reactive, ref, watch, onMounted, onUnmounted } from "vue";
import {
  MiuixButton,
  MiuixCard,
  MiuixSwitch,
  MiuixSlider,
  MiuixNavigationBar,
  useTheme,
} from "miuix-vue";
import defaultText from "../config.sh?raw";
import {
  parseSettings,
  validateSettings,
  simulate,
  formatDuration,
} from "./settings.js";
import { deviceCommand, onDevice } from "./device.js";
import { toggleDarkMode } from "./theme.js";

const defaults = parseSettings(defaultText);
const settings = reactive({
  INACTIVE_MINUTES: String(defaults.INACTIVE_MINUTES),
  CHECK_INTERVAL: String(defaults.CHECK_INTERVAL),
  BOOT_GRACE_SECONDS: String(defaults.BOOT_GRACE_SECONDS),
  DRY_RUN: defaults.DRY_RUN === 1,
});
const loaded = ref(false);
const busy = ref(false);
const message = ref("");
const isError = ref(false);
const screen = ref("idle");
const idleSeconds = ref(0);
const playing = ref(false);
const activeTab = ref(0);
const navigationItems = [{ label: "Home" }, { label: "Preview" }];
const { theme } = useTheme();
const presets = [
  { minutes: 120, label: "2 hours" },
  { minutes: 360, label: "6 hours" },
  { minutes: 720, label: "12 hours" },
  { minutes: 1440, label: "24 hrs" },
  { minutes: 4320, label: "3 days" },
  { minutes: 10080, label: "7 days" },
];
let populating = false;
let frameId;
let lastFrame;

function readSettings() {
  return validateSettings({ ...settings, DRY_RUN: settings.DRY_RUN ? 1 : 0 });
}
const validationError = computed(() => {
  try {
    readSettings();
    return "";
  } catch (error) {
    return error.message;
  }
});
const config = computed(() => {
  try {
    return readSettings();
  } catch {
    return defaults;
  }
});
const preview = computed(() =>
  simulate(config.value, idleSeconds.value, screen.value),
);
const previewState = computed(() =>
  screen.value === "awake"
    ? "Screen on · timer reset"
    : preview.value.due
      ? config.value.DRY_RUN
        ? "Would log a dry-run event"
        : "Would request a reboot"
      : "Screen off · counting down",
);
const thresholdLabel = computed(() =>
  config.value.INACTIVE_MINUTES >= 60
    ? `${Number((config.value.INACTIVE_MINUTES / 60).toFixed(2))} hours`
    : `${config.value.INACTIVE_MINUTES} minutes`,
);
const disabled = computed(() => !loaded.value || busy.value);

function feedback(text, error = false) {
  message.value = text;
  isError.value = error;
}
function resetPreview() {
  idleSeconds.value = 0;
  playing.value = false;
}
function populate(value) {
  populating = true;
  for (const key of Object.keys(defaults))
    settings[key] = key === "DRY_RUN" ? value[key] === 1 : String(value[key]);
  populating = false;
  resetPreview();
}
watch(
  settings,
  () => {
    if (!populating) {
      resetPreview();
      feedback(onDevice ? "Unsaved changes." : "");
    }
  },
  { flush: "sync" },
);

async function load() {
  busy.value = true;
  loaded.value = false;
  try {
    if (onDevice) populate(parseSettings(await deviceCommand("read")));
    else populate(defaults);
    loaded.value = true;
    feedback("");
  } catch (error) {
    feedback(error.message, true);
  } finally {
    busy.value = false;
  }
}

async function save() {
  if (disabled.value || !onDevice) return;
  try {
    const value = readSettings();
    busy.value = true;
    await deviceCommand("save " + Object.values(value).join(" "));
    feedback("Settings saved. Changes apply at the next check.");
  } catch (error) {
    feedback(error.message, true);
  } finally {
    busy.value = false;
  }
}

function restoreDefaults() {
  populate(defaults);
  feedback(onDevice ? "Defaults restored. Save to apply." : "");
}
function setScreen(value) {
  screen.value = value;
  resetPreview();
}
function setIdle(value) {
  idleSeconds.value = value;
  playing.value = false;
}
function sliderKey(event) {
  if (screen.value === "awake" || validationError.value) return;
  const max = config.value.INACTIVE_MINUTES * 60;
  const values = {
    Home: 0,
    End: max,
    ArrowRight: Math.min(max, idleSeconds.value + 60),
    ArrowLeft: Math.max(0, idleSeconds.value - 60),
  };
  if (Object.hasOwn(values, event.key)) {
    event.preventDefault();
    setIdle(values[event.key]);
  }
}
function togglePlayback() {
  if (preview.value.due) idleSeconds.value = 0;
  playing.value = !playing.value;
  lastFrame = undefined;
}
function selectTab(index) {
  activeTab.value = index;
  if (index === 0) playing.value = false;
  window.scrollTo(0, 0);
}
function navigationKey(event) {
  if (!event.target.closest('[role="tab"]')) return;
  const indices = {
    ArrowLeft: (activeTab.value - 1 + navigationItems.length) % navigationItems.length,
    ArrowRight: (activeTab.value + 1) % navigationItems.length,
    Home: 0,
    End: navigationItems.length - 1,
  };
  if (!Object.hasOwn(indices, event.key)) return;
  event.preventDefault();
  selectTab(indices[event.key]);
  event.currentTarget.querySelectorAll('[role="tab"]')[activeTab.value].focus();
}
function frame(time) {
  if (playing.value && lastFrame !== undefined) {
    idleSeconds.value = Math.min(
      config.value.INACTIVE_MINUTES * 60,
      idleSeconds.value + ((time - lastFrame) / 1000) * 360,
    );
    if (preview.value.due) playing.value = false;
  }
  lastFrame = time;
  frameId = requestAnimationFrame(frame);
}
onMounted(() => {
  load();
  frameId = requestAnimationFrame(frame);
});
onUnmounted(() => cancelAnimationFrame(frameId));
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <h1 class="brand">
        <span class="brand-mark" aria-hidden="true">↻</span> watchdog
      </h1>
      <div class="header-actions">
        <div class="theme-control">
          <svg v-if="theme === 'dark'" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M20.4 14.1A8.7 8.7 0 0 1 9.9 3.6a8.8 8.8 0 1 0 10.5 10.5Z"
            />
          </svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            />
          </svg>
          <MiuixSwitch
            :model-value="theme === 'dark'"
            aria-label="Dark mode"
            @update:model-value="toggleDarkMode"
          />
        </div>
      </div>
    </header>
    <main>
      <div class="workspace">
        <section
          v-show="activeTab === 0"
          id="home-panel"
          role="tabpanel"
          aria-label="Home"
        >
          <h2 id="settings-title" class="section-title">Settings</h2>
          <MiuixCard class="settings-card" :show-indication="false">
            <form id="settings-form" @submit.prevent="save">
              <fieldset :disabled="disabled">
                <div class="duration-section">
                  <label class="field-label" for="idle-minutes"
                    >Inactivity duration</label
                  >
                  <div class="large-input">
                    <input
                      id="idle-minutes"
                      v-model="settings.INACTIVE_MINUTES"
                      name="INACTIVE_MINUTES"
                      type="number"
                      min="1"
                      max="43200"
                      step="1"
                      required
                    /><span>minutes</span>
                  </div>
                  <div class="presets" aria-label="Duration presets">
                    <MiuixButton
                      v-for="preset in presets"
                      :key="preset.minutes"
                      :disabled="disabled"
                      :type="
                        Number(settings.INACTIVE_MINUTES) === preset.minutes
                          ? 'primary'
                          : 'default'
                      "
                      :aria-pressed="
                        Number(settings.INACTIVE_MINUTES) === preset.minutes
                      "
                      @click="
                        settings.INACTIVE_MINUTES = String(preset.minutes)
                      "
                      >{{ preset.label }}</MiuixButton
                    >
                  </div>
                </div>
                <div class="small-fields">
                  <div>
                    <label class="field-label" for="check-interval"
                      >Check every</label
                    >
                    <div class="number-input">
                      <input
                        id="check-interval"
                        v-model="settings.CHECK_INTERVAL"
                        name="CHECK_INTERVAL"
                        type="number"
                        min="5"
                        max="3600"
                        step="1"
                        required
                      /><span>sec</span>
                    </div>
                  </div>
                  <div>
                    <label class="field-label" for="boot-grace"
                      >Boot delay</label
                    >
                    <div class="number-input">
                      <input
                        id="boot-grace"
                        v-model="settings.BOOT_GRACE_SECONDS"
                        name="BOOT_GRACE_SECONDS"
                        type="number"
                        min="0"
                        max="86400"
                        step="1"
                        required
                      /><span>sec</span>
                    </div>
                    <p class="field-help">
                      Applies next boot.
                    </p>
                  </div>
                </div>
                <div class="toggle-row">
                  <div>
                    <span id="dry-run-title" class="field-label">Dry run</span>
                    <p id="dry-run-help" class="field-help">
                      Log instead of rebooting.
                    </p>
                  </div>
                  <MiuixSwitch
                    v-model="settings.DRY_RUN"
                    :disabled="disabled"
                    aria-labelledby="dry-run-title"
                    aria-describedby="dry-run-help"
                  />
                </div>
              </fieldset>
              <div v-if="onDevice" class="form-actions">
                <MiuixButton
                  id="save"
                  type="primary"
                  :disabled="disabled || !!validationError"
                  @click="save"
                  >{{ busy ? "Loading…" : "Save" }}</MiuixButton
                >
              </div>
              <button
                id="defaults"
                type="button"
                class="text-button"
                :disabled="disabled"
                @click="restoreDefaults"
              >
                Restore defaults
              </button>
            </form>
            <p
              id="feedback"
              class="feedback"
              :class="{ error: isError || validationError }"
              role="status"
              aria-live="polite"
            >
              {{ validationError || message }}
            </p>
            <MiuixButton
              v-if="onDevice && !loaded && !busy"
              id="retry"
              @click="load"
              >Retry</MiuixButton
            >
          </MiuixCard>
        </section>
        <section
          v-show="activeTab === 1"
          id="preview-panel"
          role="tabpanel"
          aria-label="Preview"
        >
          <h2 id="preview-title" class="section-title">Preview</h2>
          <MiuixCard class="preview-card" :show-indication="false">
            <p class="preview-description">
              Simulation only
            </p>
            <div class="ring-wrap">
              <div
                id="countdown-ring"
                class="countdown-ring"
                :style="{ '--progress': preview.progress }"
              >
                <div class="ring-center">
                  <span id="countdown-label" class="countdown-label">{{
                    config.DRY_RUN ? "Until dry run" : "Until reboot"
                  }}</span
                  ><output id="remaining" aria-live="off">{{
                    formatDuration(preview.remaining)
                  }}</output
                  ><span id="preview-state" class="state-label">{{
                    previewState
                  }}</span>
                </div>
              </div>
            </div>
            <div class="screen-control" aria-label="Simulated screen state">
              <MiuixButton
                :type="screen === 'idle' ? 'primary' : 'default'"
                :aria-pressed="screen === 'idle'"
                @click="setScreen('idle')"
                >Screen off</MiuixButton
              ><MiuixButton
                :type="screen === 'awake' ? 'primary' : 'default'"
                :aria-pressed="screen === 'awake'"
                @click="setScreen('awake')"
                >Screen on</MiuixButton
              >
            </div>
            <div class="scrubber-heading">
              <span id="slider-label">Idle time</span
              ><output id="elapsed" aria-live="off">{{
                formatDuration(preview.elapsed)
              }}</output>
            </div>
            <MiuixSlider
              id="idle-progress"
              :model-value="preview.elapsed"
              :min="0"
              :max="config.INACTIVE_MINUTES * 60"
              :step="0"
              :disabled="screen === 'awake' || !!validationError"
              aria-labelledby="slider-label"
              :aria-valuetext="formatDuration(preview.elapsed)"
              @update:model-value="setIdle"
              @keydown="sliderKey"
            />
            <div class="range-labels">
              <span>0</span
              ><span id="threshold-label">{{ thresholdLabel }}</span>
            </div>
            <div class="playback">
              <MiuixButton
                id="play"
                :disabled="screen === 'awake' || !!validationError"
                @click="togglePlayback"
                >{{ playing ? "Pause" : "Run" }}</MiuixButton
              ><button
                id="reset-preview"
                type="button"
                class="text-button"
                @click="resetPreview"
              >
                Reset</button
              ><span>360×</span>
            </div>
          </MiuixCard>
        </section>
      </div>
    </main>
    <MiuixNavigationBar
      class="bottom-navigation"
      :model-value="activeTab"
      :items="navigationItems"
      role="tablist"
      aria-label="Main navigation"
      @update:model-value="selectTab"
      @keydown="navigationKey"
    >
      <template #icon="{ index }">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <template v-if="index === 0">
            <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
            <path d="M9 21v-8h6v8" />
          </template>
          <template v-else>
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l3 2M9 2h6M12 2v3m6 1 2-2" />
          </template>
        </svg>
      </template>
    </MiuixNavigationBar>
  </div>
</template>
