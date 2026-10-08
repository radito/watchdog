import { createApp } from "vue";
import "miuix-vue/style.css";
import "./style.css";
import App from "./App.vue";
import { initializeTheme } from "./theme.js";

initializeTheme();
createApp(App).mount("#app");
