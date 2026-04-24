const STORAGE_KEY = "english-checkin-lab-v1";
const APP_SCHEMA_VERSION = 2;

const DEFAULT_TASKS = [
  { id: "vocab", label: "词汇与词块", description: "复习高频词块、Anki 卡片、例句迁移。", target: 20 },
  { id: "listening", label: "听力/精听", description: "TED-ED 或雅思精听，抓弱读、连读和漏听。", target: 20 },
  { id: "speaking", label: "跟读/口语", description: "跟读一段或做 60 秒口语输出。", target: 15 },
  { id: "reading", label: "阅读/学术英语", description: "精读一段材料，提取句型与表达。", target: 15 },
  { id: "writing", label: "写作/摘要", description: "写 80 到 150 词摘要、改写或短段落。", target: 15 },
  { id: "review", label: "纠错与复盘", description: "回看错误日志，整理今天最值得保留的表达。", target: 10 },
];

const DEFAULT_RESOURCES = [
  {
    id: "starter-pack",
    title: "原创英语学习包",
    category: "总览",
    description: "一套可公开使用的原创材料，覆盖词汇、阅读、口语、写作和周计划。",
    href: "./materials/original-english-kit.html",
  },
  {
    id: "starter-vocab",
    title: "词块与复现训练",
    category: "词汇",
    description: "高频学术动词、口语控制表达和检索练习。",
    href: "./materials/original-english-kit.html#vocabulary",
  },
  {
    id: "starter-reading",
    title: "精读与问题链",
    category: "阅读",
    description: "两篇原创短文，适合精读、摘要和观点复述。",
    href: "./materials/original-english-kit.html#reading",
  },
  {
    id: "starter-speaking",
    title: "跟读与口语脚本",
    category: "口语",
    description: "三段原创 shadowing 文本和输出任务。",
    href: "./materials/original-english-kit.html#speaking",
  },
  {
    id: "starter-writing",
    title: "写作模板与提示",
    category: "写作",
    description: "摘要、观点段、邮件和反思模板，适合每天小输出。",
    href: "./materials/original-english-kit.html#writing",
  },
  {
    id: "starter-plan",
    title: "7 天训练安排",
    category: "计划",
    description: "把输入、输出、纠错和复盘串起来的原创一周计划。",
    href: "./materials/original-english-kit.html#weekly-plan",
  },
];

const DEFAULT_SETTINGS = {
  displayName: "学习者",
  goalMinutes: 90,
};

const DEFAULT_SUPABASE_CONFIG = {
  url: "",
  anonKey: "",
  stateTable: "user_app_state",
};

const els = {};

const cloud = {
  client: null,
  config: { ...DEFAULT_SUPABASE_CONFIG },
  available: false,
  configured: false,
  session: null,
  user: null,
  syncInFlight: false,
  pendingSync: false,
  lastRemoteTimestamp: "",
  statusTone: "warn",
  statusTitle: "本地模式",
  statusText: "还没有接上云端，当前只会保存到这个浏览器。",
  hintText: "先按说明填写 supabase-config.js，再开启邮箱登录和数据表。",
};

let appState = loadState();
let selectedDateKey = todayKey();
let deferredInstallPrompt = null;
let toastTimer = null;
let autoSyncTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
    showToast("初始化失败，请刷新重试");
  });
});

async function init() {
  cacheElements();
  bindStaticEvents();
  registerInstallPrompt();
  registerServiceWorker();
  renderApp();
  await initSupabase();
}

function cacheElements() {
  els.installBtn = document.querySelector("#installBtn");
  els.heroDateLabel = document.querySelector("#heroDateLabel");
  els.heroCheckStatus = document.querySelector("#heroCheckStatus");
  els.heroSummary = document.querySelector("#heroSummary");
  els.heroProgressBar = document.querySelector("#heroProgressBar");
  els.heroMinutesMeta = document.querySelector("#heroMinutesMeta");
  els.heroCompletionMeta = document.querySelector("#heroCompletionMeta");
  els.cloudModeBadge = document.querySelector("#cloudModeBadge");
  els.cloudUserBadge = document.querySelector("#cloudUserBadge");
  els.cloudStatusText = document.querySelector("#cloudStatusText");
  els.authForm = document.querySelector("#authForm");
  els.authEmailInput = document.querySelector("#authEmailInput");
  els.sendMagicLinkBtn = document.querySelector("#sendMagicLinkBtn");
  els.syncMetaText = document.querySelector("#syncMetaText");
  els.syncNowBtn = document.querySelector("#syncNowBtn");
  els.pullCloudBtn = document.querySelector("#pullCloudBtn");
  els.signOutBtn = document.querySelector("#signOutBtn");
  els.authHint = document.querySelector("#authHint");
  els.statsGrid = document.querySelector("#statsGrid");
  els.prevDayBtn = document.querySelector("#prevDayBtn");
  els.nextDayBtn = document.querySelector("#nextDayBtn");
  els.datePicker = document.querySelector("#datePicker");
  els.selectedDateSummary = document.querySelector("#selectedDateSummary");
  els.toggleCheckInBtn = document.querySelector("#toggleCheckInBtn");
  els.resetDayBtn = document.querySelector("#resetDayBtn");
  els.taskGrid = document.querySelector("#taskGrid");
  els.focusInput = document.querySelector("#focusInput");
  els.reflectionInput = document.querySelector("#reflectionInput");
  els.displayNameInput = document.querySelector("#displayNameInput");
  els.goalMinutesInput = document.querySelector("#goalMinutesInput");
  els.heatmapGrid = document.querySelector("#heatmapGrid");
  els.resourceGrid = document.querySelector("#resourceGrid");
  els.resourceForm = document.querySelector("#resourceForm");
  els.exportBtn = document.querySelector("#exportBtn");
  els.importBtn = document.querySelector("#importBtn");
  els.importFileInput = document.querySelector("#importFileInput");
  els.toast = document.querySelector("#toast");
}

function bindStaticEvents() {
  els.prevDayBtn.addEventListener("click", () => {
    selectedDateKey = shiftDate(selectedDateKey, -1);
    renderApp();
  });

  els.nextDayBtn.addEventListener("click", () => {
    selectedDateKey = shiftDate(selectedDateKey, 1);
    renderApp();
  });

  els.datePicker.addEventListener("change", (event) => {
    if (!event.target.value) {
      return;
    }
    selectedDateKey = event.target.value;
    renderApp();
  });

  els.toggleCheckInBtn.addEventListener("click", () => {
    const log = getLog(selectedDateKey);
    log.checkedIn = !log.checkedIn;
    log.checkedAt = log.checkedIn ? new Date().toISOString() : "";
    persistState();
    renderApp();
    showToast(log.checkedIn ? "已完成当天打卡" : "已取消当天打卡");
  });

  els.resetDayBtn.addEventListener("click", () => {
    const shouldReset = window.confirm("确认清空这一天的学习记录？");
    if (!shouldReset) {
      return;
    }
    appState.logs[selectedDateKey] = createEmptyLog();
    persistState();
    renderApp();
    showToast("当天记录已清空");
  });

  els.focusInput.addEventListener("input", (event) => {
    const log = getLog(selectedDateKey);
    log.focus = event.target.value;
    persistState();
  });

  els.reflectionInput.addEventListener("input", (event) => {
    const log = getLog(selectedDateKey);
    log.reflection = event.target.value;
    persistState();
  });

  els.displayNameInput.addEventListener("input", (event) => {
    appState.settings.displayName = event.target.value.trim() || DEFAULT_SETTINGS.displayName;
    persistState();
    renderApp();
  });

  els.goalMinutesInput.addEventListener("input", (event) => {
    const parsed = toPositiveNumber(event.target.value, DEFAULT_SETTINGS.goalMinutes);
    appState.settings.goalMinutes = clamp(parsed, 30, 360);
    persistState();
    renderApp();
  });

  els.taskGrid.addEventListener("click", handleTaskGridClick);
  els.taskGrid.addEventListener("input", handleTaskGridInput);
  els.taskGrid.addEventListener("change", handleTaskGridInput);

  els.heatmapGrid.addEventListener("click", (event) => {
    const cell = event.target.closest("[data-date]");
    if (!cell) {
      return;
    }
    selectedDateKey = cell.dataset.date;
    renderApp();
  });

  els.resourceForm.addEventListener("submit", handleResourceSubmit);

  els.resourceGrid.addEventListener("click", (event) => {
    const removeBtn = event.target.closest("[data-remove-resource]");
    if (!removeBtn) {
      return;
    }
    const resourceId = removeBtn.dataset.removeResource;
    appState.customResources = appState.customResources.filter((item) => item.id !== resourceId);
    persistState();
    renderResources();
    showToast("已移除自定义资源");
  });

  els.exportBtn.addEventListener("click", exportState);
  els.importBtn.addEventListener("click", () => els.importFileInput.click());
  els.importFileInput.addEventListener("change", importState);

  els.authForm.addEventListener("submit", handleAuthSubmit);
  els.syncNowBtn.addEventListener("click", async () => {
    await syncWithCloud({ mode: "merge" });
  });
  els.pullCloudBtn.addEventListener("click", async () => {
    await syncWithCloud({ mode: "pull" });
  });
  els.signOutBtn.addEventListener("click", handleSignOut);

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }
    appState = loadState();
    renderApp();
  });

  window.addEventListener("online", () => {
    showToast("网络已恢复");
    scheduleCloudSync(600);
  });
}

async function initSupabase() {
  const globalConfig = window.SUPABASE_CONFIG || {};
  cloud.config = {
    ...DEFAULT_SUPABASE_CONFIG,
    ...globalConfig,
  };
  cloud.configured = Boolean(cloud.config.url && cloud.config.anonKey);
  cloud.available = Boolean(window.supabase?.createClient) && cloud.configured;

  if (!window.supabase?.createClient) {
    setCloudStatus("warn", "本地模式", "Supabase SDK 没有加载成功，当前只会保存到这个浏览器。", "检查网络，或者稍后刷新页面。");
    renderApp();
    return;
  }

  if (!cloud.configured) {
    setCloudStatus("warn", "本地模式", "还没有填写 Supabase 配置，当前只会保存到这个浏览器。", "打开 Supabase接入说明.md，先配置项目 URL、匿名 key 和数据表。");
    renderApp();
    return;
  }

  const { createClient } = window.supabase;
  cloud.client = createClient(cloud.config.url, cloud.config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  cloud.client.auth.onAuthStateChange((event, session) => {
    window.setTimeout(() => {
      handleAuthStateChange(event, session).catch((error) => {
        console.error(error);
        setCloudStatus("danger", "同步异常", "认证状态更新失败。", readableError(error));
        renderApp();
      });
    }, 0);
  });

  const { data, error } = await cloud.client.auth.getSession();
  if (error) {
    setCloudStatus("danger", "同步异常", "无法读取当前登录状态。", readableError(error));
    renderApp();
    return;
  }

  await handleAuthStateChange("INITIAL_SESSION", data.session);
}

async function handleAuthStateChange(event, session) {
  cloud.session = session;
  cloud.user = session?.user ?? null;

  if (!cloud.user) {
    setCloudStatus(
      cloud.available ? "warn" : "warn",
      cloud.available ? "云端待连接" : "本地模式",
      cloud.available ? "输入邮箱后会收到一封登录链接，点开后这个设备就会连接到你的云端数据。" : "还没有接上云端，当前只会保存到这个浏览器。",
      cloud.available ? "同一个邮箱可以在手机和电脑上分别登录，从而共用同一份学习记录。" : "先完成 Supabase 配置，再回来登录。"
    );
    renderApp();
    return;
  }

  if (event === "TOKEN_REFRESHED") {
    setCloudStatus("good", "云端已连接", `${cloud.user.email || "当前账号"} 已登录，等待下一次同步。`, buildSyncMetaText());
    renderApp();
    return;
  }

  await syncWithCloud({ mode: "merge", silent: event === "INITIAL_SESSION" });
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  if (!cloud.available || !cloud.client) {
    showToast("请先配置 Supabase");
    return;
  }

  const email = els.authEmailInput.value.trim();
  if (!email) {
    showToast("请先输入邮箱");
    return;
  }

  els.sendMagicLinkBtn.disabled = true;
  setCloudStatus("warn", "发送中", `正在向 ${email} 发送登录链接。`, "如果几分钟内没收到，请检查垃圾邮件箱。");
  renderAuthPanel();

  try {
    const { error } = await cloud.client.auth.signInWithOtp({ email });
    if (error) {
      throw error;
    }

    setCloudStatus("warn", "等待确认", `登录链接已发送到 ${email}。`, "请在当前设备打开邮箱并点击链接；返回页面后会自动完成登录和同步。");
    renderAuthPanel();
    showToast("登录链接已发送");
  } catch (error) {
    setCloudStatus("danger", "发送失败", "发送登录链接失败。", readableError(error));
    renderAuthPanel();
    showToast("发送失败，请检查配置");
  } finally {
    els.sendMagicLinkBtn.disabled = false;
  }
}

async function handleSignOut() {
  if (!cloud.client || !cloud.user) {
    return;
  }

  try {
    const { error } = await cloud.client.auth.signOut();
    if (error) {
      throw error;
    }
    setCloudStatus("warn", "已退出登录", "这个设备已回到本地模式。", "本地记录仍然保留；再次登录同一个邮箱后会继续同步。");
    renderApp();
    showToast("已退出登录");
  } catch (error) {
    setCloudStatus("danger", "退出失败", "无法退出当前账号。", readableError(error));
    renderApp();
    showToast("退出失败");
  }
}

function handleTaskGridClick(event) {
  const stepBtn = event.target.closest("[data-step-task]");
  if (!stepBtn) {
    return;
  }

  const taskId = stepBtn.dataset.stepTask;
  const delta = Number(stepBtn.dataset.stepValue || 0);
  const log = getLog(selectedDateKey);
  const task = log.tasks[taskId];
  task.minutes = clamp(task.minutes + delta, 0, 360);
  persistState();
  renderApp();
}

function handleTaskGridInput(event) {
  const target = event.target;
  const taskId = target.dataset.taskId;
  const field = target.dataset.taskField;
  if (!taskId || !field) {
    return;
  }

  if (field === "note" && event.type !== "input") {
    return;
  }

  if ((field === "minutes" || field === "done") && event.type === "input") {
    return;
  }

  const log = getLog(selectedDateKey);
  const task = log.tasks[taskId];

  if (field === "done") {
    task.done = Boolean(target.checked);
  }

  if (field === "minutes") {
    task.minutes = clamp(toPositiveNumber(target.value, 0), 0, 360);
  }

  if (field === "note") {
    task.note = target.value;
  }

  persistState();
  if (field !== "note") {
    renderApp();
  }
}

function handleResourceSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const title = String(formData.get("title") || "").trim();
  const href = String(formData.get("url") || "").trim();
  const category = String(formData.get("category") || "").trim() || "自定义";

  if (!title || !href) {
    showToast("请先填写名称和链接");
    return;
  }

  appState.customResources.unshift({
    id: cryptoRandomId(),
    title,
    href,
    category,
    description: "你自己添加的资源入口。",
  });

  event.currentTarget.reset();
  persistState();
  renderResources();
  showToast("资源已加入页面");
}

function exportState() {
  const blob = new Blob([JSON.stringify(appState, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = `english-checkin-backup-${todayKey()}.json`;
  anchor.click();
  URL.revokeObjectURL(downloadUrl);
  showToast("备份文件已导出");
}

async function importState(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const shouldImport = window.confirm("确认用这份备份覆盖当前浏览器里的数据？");
    if (!shouldImport) {
      event.target.value = "";
      return;
    }

    appState = normalizeState(parsed);
    persistState({ markDirty: true, scheduleSync: true });
    selectedDateKey = todayKey();
    renderApp();
    showToast("备份已导入");
  } catch (error) {
    showToast("导入失败：文件格式不正确");
  } finally {
    event.target.value = "";
  }
}

function registerInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installBtn.hidden = false;
  });

  els.installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      showToast("当前设备暂不支持安装提示");
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installBtn.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    els.installBtn.hidden = true;
    showToast("应用已安装");
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      showToast("Service Worker 注册失败");
    });
  });
}

function renderApp() {
  const log = getLog(selectedDateKey);
  renderHero(log);
  renderAuthPanel();
  renderStats(log);
  renderSelectedDay(log);
  renderTaskGrid(log);
  renderHeatmap();
  renderResources();
}

function renderHero(log) {
  const goalMinutes = appState.settings.goalMinutes;
  const minutes = getLogMinutes(log);
  const completion = getLogCompletion(log);
  const name = appState.settings.displayName || DEFAULT_SETTINGS.displayName;
  const viewingToday = selectedDateKey === todayKey();
  const checkedText = log.checkedIn ? "已打卡" : "未打卡";

  document.title = `${name}的英语打卡 Lab`;
  els.heroDateLabel.textContent = viewingToday ? "今天" : formatLongDate(selectedDateKey);
  els.heroCheckStatus.textContent = checkedText;
  els.heroSummary.textContent =
    completion > 0
      ? `${name}，这一天完成度 ${completion}%，继续把输出和复盘做完。`
      : `${name}，先完成今天的第一项训练，再把这一页打满。`;
  els.heroProgressBar.style.width = `${completion}%`;
  els.heroMinutesMeta.textContent = `${minutes} / ${goalMinutes} 分钟`;
  els.heroCompletionMeta.textContent = `${completion}%`;
}

function renderAuthPanel() {
  const toneClass = cloud.statusTone === "good" ? "is-good" : cloud.statusTone === "danger" ? "is-danger" : "is-warn";

  els.cloudModeBadge.className = `status-pill ${toneClass}`;
  els.cloudModeBadge.textContent = cloud.statusTitle;
  els.cloudUserBadge.textContent = cloud.user?.email || (cloud.available ? "未登录" : "未配置");
  els.cloudStatusText.textContent = cloud.statusText;
  els.syncMetaText.textContent = buildSyncMetaText();
  els.authHint.textContent = cloud.hintText;

  const authBusy = cloud.syncInFlight;
  els.authEmailInput.disabled = !cloud.available || authBusy || Boolean(cloud.user);
  els.sendMagicLinkBtn.disabled = !cloud.available || authBusy || Boolean(cloud.user);
  els.syncNowBtn.disabled = !cloud.available || !cloud.user || authBusy;
  els.pullCloudBtn.disabled = !cloud.available || !cloud.user || authBusy;
  els.signOutBtn.disabled = !cloud.available || !cloud.user || authBusy;
}

function renderStats(selectedLog) {
  const stats = [
    { label: "连续打卡", value: `${getCurrentStreak()} 天`, footnote: "以今天为终点连续计算" },
    { label: "累计打卡", value: `${getCheckedInCount()} 天`, footnote: "手动点过“完成今日打卡”的天数" },
    { label: "总学习时长", value: `${getTotalMinutes()} 分`, footnote: "全部日期累积时长" },
    { label: "最近 7 天", value: `${getRecentCheckedInDays(7)} 天`, footnote: "最近一周的实际打卡天数" },
    { label: "当天完成度", value: `${getLogCompletion(selectedLog)}%`, footnote: `${getLogMinutes(selectedLog)} 分钟，查看的是 ${formatShortDate(selectedDateKey)}` },
    {
      label: "同步状态",
      value: cloud.user ? "已连云" : "本地",
      footnote: cloud.user ? `账号：${cloud.user.email || "已登录"}` : cloud.available ? "未登录账号时只保存本地" : "尚未配置 Supabase",
    },
  ];

  els.statsGrid.innerHTML = stats
    .map(
      (item) => `
        <article class="stat-card">
          <p class="stat-label">${escapeHtml(item.label)}</p>
          <p class="stat-value">${escapeHtml(item.value)}</p>
          <p class="stat-footnote">${escapeHtml(item.footnote)}</p>
        </article>
      `
    )
    .join("");
}

function renderSelectedDay(log) {
  els.datePicker.value = selectedDateKey;
  els.focusInput.value = log.focus;
  els.reflectionInput.value = log.reflection;
  els.displayNameInput.value = appState.settings.displayName;
  els.goalMinutesInput.value = String(appState.settings.goalMinutes);
  els.selectedDateSummary.textContent = `${formatLongDate(selectedDateKey)} · ${log.checkedIn ? "已打卡" : "未打卡"}`;
  els.toggleCheckInBtn.textContent = log.checkedIn ? "取消当天打卡" : "完成今日打卡";
}

function renderTaskGrid(log) {
  els.taskGrid.innerHTML = DEFAULT_TASKS.map((task, index) => {
    const item = log.tasks[task.id];
    const progress = item.done ? 100 : Math.round(Math.min(item.minutes / task.target, 1) * 100);
    return `
      <article class="task-card ${item.done ? "is-done" : ""}">
        <div class="task-top">
          <div>
            <span class="task-index">${String(index + 1).padStart(2, "0")}</span>
            <h3 class="task-title">${escapeHtml(task.label)}</h3>
            <p class="task-desc">${escapeHtml(task.description)}</p>
          </div>
          <label class="task-check">
            <input type="checkbox" data-task-id="${task.id}" data-task-field="done" ${item.done ? "checked" : ""}>
            完成
          </label>
        </div>
        <div class="task-metrics">
          <div class="task-target">建议 ${task.target} 分钟</div>
          <div class="task-stepper">
            <button type="button" data-step-task="${task.id}" data-step-value="-5">-5</button>
            <input type="number" min="0" max="360" value="${item.minutes}" data-task-id="${task.id}" data-task-field="minutes">
            <button type="button" data-step-task="${task.id}" data-step-value="5">+5</button>
          </div>
          <div class="mini-progress"><span style="width:${progress}%"></span></div>
        </div>
        <textarea class="task-note" rows="4" data-task-id="${task.id}" data-task-field="note" placeholder="写下今天这一项具体做了什么。">${escapeHtml(item.note)}</textarea>
      </article>
    `;
  }).join("");
}

function renderHeatmap() {
  const recentKeys = getRecentDateKeys(28);
  els.heatmapGrid.innerHTML = recentKeys
    .map((dateKey) => {
      const log = getLogSnapshot(dateKey);
      const completion = getLogCompletion(log);
      const level = getCompletionLevel(completion);
      const selectedClass = dateKey === selectedDateKey ? "selected" : "";
      const title = `${dateKey} · ${log.checkedIn ? "已打卡" : "未打卡"} · ${completion}%`;
      return `
        <button
          type="button"
          class="heatmap-cell level-${level} ${selectedClass}"
          data-date="${dateKey}"
          title="${escapeHtml(title)}"
          aria-label="${escapeHtml(title)}"
        ></button>
      `;
    })
    .join("");
}

function renderResources() {
  const allResources = [...appState.customResources, ...DEFAULT_RESOURCES];
  if (allResources.length === 0) {
    els.resourceGrid.innerHTML = `
      <article class="resource-card">
        <div class="resource-head">
          <div>
            <div class="resource-badge">空白起步</div>
            <h3 class="resource-title">先添加你自己的常用资源</h3>
          </div>
        </div>
        <p class="resource-desc">这里默认不再放任何本地资料，避免把私人文件、成绩单或无关材料误传到 GitHub。你可以手动添加课程链接、词典、题库或论文入口。</p>
        <div class="resource-tools">
          <span class="resource-link">从上方表单开始添加</span>
        </div>
      </article>
    `;
    return;
  }

  els.resourceGrid.innerHTML = allResources
    .map((resource) => {
      const isCustom = appState.customResources.some((item) => item.id === resource.id);
      const trailingAction = isCustom
        ? `<button class="delete-link" type="button" data-remove-resource="${resource.id}">移除</button>`
        : `<span class="resource-link">内置资源</span>`;

      return `
        <article class="resource-card">
          <div class="resource-head">
            <div>
              <div class="resource-badge">${escapeHtml(resource.category)}</div>
              <h3 class="resource-title">${escapeHtml(resource.title)}</h3>
            </div>
          </div>
          <p class="resource-desc">${escapeHtml(resource.description)}</p>
          <div class="resource-tools">
            <a class="resource-link" href="${escapeAttribute(resource.href)}" target="_blank" rel="noreferrer">打开资源</a>
            ${trailingAction}
          </div>
        </article>
      `;
    })
    .join("");
}

async function syncWithCloud({ mode = "merge", silent = false } = {}) {
  if (!cloud.client || !cloud.user) {
    if (!silent) {
      showToast("请先登录云端账号");
    }
    return;
  }

  if (cloud.syncInFlight) {
    cloud.pendingSync = true;
    return;
  }

  cloud.syncInFlight = true;
  setCloudStatus("warn", "同步中", mode === "pull" ? "正在从云端读取最新记录。" : "正在比较本地和云端哪一份更新。", "同步期间按钮会暂时禁用。");
  renderApp();

  try {
    const remoteRow = await fetchRemoteState();
    const localMs = parseTimestamp(appState.meta.lastModifiedAt);
    const remoteMs = parseTimestamp(remoteRow?.client_updated_at);

    if (mode === "pull") {
      if (!remoteRow?.state) {
        setCloudStatus("warn", "云端为空", "云端还没有保存任何学习记录。", buildSyncMetaText());
        renderApp();
        if (!silent) {
          showToast("云端还没有数据");
        }
        return;
      }
      cloud.lastRemoteTimestamp = remoteRow.client_updated_at || "";
      applyRemoteState(remoteRow, "已用云端记录覆盖本地。");
      if (!silent) {
        showToast("已从云端拉取");
      }
      return;
    }

    if (!remoteRow?.state) {
      await pushStateToCloud();
      if (!silent) {
        showToast("已创建云端记录");
      }
      return;
    }

    if (remoteMs > localMs + 1000) {
      cloud.lastRemoteTimestamp = remoteRow.client_updated_at || "";
      applyRemoteState(remoteRow, "检测到云端较新，已自动拉取。");
      if (!silent) {
        showToast("已载入较新的云端数据");
      }
      return;
    }

    if (localMs > remoteMs + 1000) {
      await pushStateToCloud();
      if (!silent) {
        showToast("本地较新，已推送到云端");
      }
      return;
    }

    appState.meta.lastSyncedAt = new Date().toISOString();
    appState.meta.lastCloudUserId = cloud.user.id;
    persistState({ markDirty: false, scheduleSync: false });
    cloud.lastRemoteTimestamp = remoteRow.client_updated_at || "";
    setCloudStatus("good", "已同步", "本地和云端已经是同一份数据。", buildSyncMetaText(remoteRow.client_updated_at));
    renderApp();
    if (!silent) {
      showToast("本地和云端已一致");
    }
  } catch (error) {
    console.error(error);
    setCloudStatus("danger", "同步失败", "无法完成云端同步。", readableError(error));
    renderApp();
    if (!silent) {
      showToast("同步失败");
    }
  } finally {
    cloud.syncInFlight = false;
    if (cloud.pendingSync) {
      cloud.pendingSync = false;
      scheduleCloudSync(300);
    }
    renderAuthPanel();
  }
}

async function fetchRemoteState() {
  const { data, error } = await cloud.client
    .from(cloud.config.stateTable)
    .select("user_id,state,client_updated_at,updated_at")
    .eq("user_id", cloud.user.id)
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0] ?? null;
}

async function pushStateToCloud() {
  const syncStamp = new Date().toISOString();
  const payloadState = normalizeState(clonePlainObject(appState));
  payloadState.meta.lastSyncedAt = syncStamp;
  payloadState.meta.lastCloudUserId = cloud.user.id;

  const { error } = await cloud.client.from(cloud.config.stateTable).upsert(
    {
      user_id: cloud.user.id,
      state: payloadState,
      client_updated_at: payloadState.meta.lastModifiedAt || syncStamp,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }

  appState = normalizeState(payloadState);
  persistState({ markDirty: false, scheduleSync: false });
  cloud.lastRemoteTimestamp = syncStamp;
  setCloudStatus("good", "已同步", "本地记录已经推送到云端。", buildSyncMetaText(syncStamp));
  renderApp();
}

function applyRemoteState(remoteRow, detailText) {
  appState = normalizeState(remoteRow.state || {});
  appState.meta.lastSyncedAt = new Date().toISOString();
  appState.meta.lastCloudUserId = cloud.user?.id || "";
  persistState({ markDirty: false, scheduleSync: false });
  cloud.lastRemoteTimestamp = remoteRow.client_updated_at || "";
  setCloudStatus("good", "云端已连接", detailText, buildSyncMetaText(remoteRow.client_updated_at));
  renderApp();
}

function scheduleCloudSync(delay = 900) {
  if (!cloud.available || !cloud.user || !navigator.onLine) {
    return;
  }
  clearTimeout(autoSyncTimer);
  autoSyncTimer = window.setTimeout(() => {
    syncWithCloud({ mode: "merge", silent: true }).catch((error) => {
      console.error(error);
    });
  }, delay);
}

function setCloudStatus(tone, title, text, hint) {
  cloud.statusTone = tone;
  cloud.statusTitle = title;
  cloud.statusText = text;
  cloud.hintText = hint;
}

function buildSyncMetaText(remoteTimestamp = cloud.lastRemoteTimestamp) {
  const pieces = [];
  if (cloud.user?.email) {
    pieces.push(`当前账号：${cloud.user.email}`);
  }
  if (appState.meta.lastModifiedAt) {
    pieces.push(`本地最后修改：${formatDateTime(appState.meta.lastModifiedAt)}`);
  }
  if (appState.meta.lastSyncedAt) {
    pieces.push(`本地最后同步：${formatDateTime(appState.meta.lastSyncedAt)}`);
  }
  if (remoteTimestamp) {
    pieces.push(`云端最新时间：${formatDateTime(remoteTimestamp)}`);
  }
  return pieces.length > 0 ? pieces.join(" · ") : "登录后会自动比较本地和云端哪一份更新。";
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return normalizeState({});
    }
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    return normalizeState({});
  }
}

function normalizeState(rawState) {
  const normalizedLogs = {};
  const sourceLogs = rawState.logs && typeof rawState.logs === "object" ? rawState.logs : {};

  Object.entries(sourceLogs).forEach(([dateKey, log]) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      normalizedLogs[dateKey] = normalizeLog(log);
    }
  });

  const normalizedState = {
    settings: {
      displayName:
        typeof rawState.settings?.displayName === "string" && rawState.settings.displayName.trim()
          ? rawState.settings.displayName.trim()
          : DEFAULT_SETTINGS.displayName,
      goalMinutes: clamp(toPositiveNumber(rawState.settings?.goalMinutes, DEFAULT_SETTINGS.goalMinutes), 30, 360),
    },
    logs: normalizedLogs,
    customResources: Array.isArray(rawState.customResources) ? rawState.customResources.map(normalizeCustomResource).filter(Boolean) : [],
    meta: {
      schemaVersion: APP_SCHEMA_VERSION,
      lastModifiedAt: "",
      lastSyncedAt: typeof rawState.meta?.lastSyncedAt === "string" ? rawState.meta.lastSyncedAt : "",
      lastCloudUserId: typeof rawState.meta?.lastCloudUserId === "string" ? rawState.meta.lastCloudUserId : "",
    },
  };

  normalizedState.meta.lastModifiedAt =
    typeof rawState.meta?.lastModifiedAt === "string" && rawState.meta.lastModifiedAt
      ? rawState.meta.lastModifiedAt
      : hasMeaningfulState(normalizedState)
        ? new Date().toISOString()
        : "";

  return normalizedState;
}

function normalizeLog(rawLog = {}) {
  const tasks = {};

  DEFAULT_TASKS.forEach((task) => {
    const rawTask = rawLog.tasks?.[task.id] || {};
    tasks[task.id] = {
      done: Boolean(rawTask.done),
      minutes: clamp(toPositiveNumber(rawTask.minutes, 0), 0, 360),
      note: typeof rawTask.note === "string" ? rawTask.note : "",
    };
  });

  return {
    checkedIn: Boolean(rawLog.checkedIn),
    checkedAt: typeof rawLog.checkedAt === "string" ? rawLog.checkedAt : "",
    focus: typeof rawLog.focus === "string" ? rawLog.focus : "",
    reflection: typeof rawLog.reflection === "string" ? rawLog.reflection : "",
    tasks,
  };
}

function normalizeCustomResource(resource) {
  if (!resource || typeof resource !== "object") {
    return null;
  }

  const title = typeof resource.title === "string" ? resource.title.trim() : "";
  const href = typeof resource.href === "string" ? resource.href.trim() : "";
  if (!title || !href) {
    return null;
  }

  return {
    id: typeof resource.id === "string" ? resource.id : cryptoRandomId(),
    title,
    href,
    category: typeof resource.category === "string" && resource.category.trim() ? resource.category.trim() : "自定义",
    description:
      typeof resource.description === "string" && resource.description.trim() ? resource.description.trim() : "你自己添加的资源入口。",
  };
}

function createEmptyLog() {
  const tasks = {};
  DEFAULT_TASKS.forEach((task) => {
    tasks[task.id] = { done: false, minutes: 0, note: "" };
  });

  return {
    checkedIn: false,
    checkedAt: "",
    focus: "",
    reflection: "",
    tasks,
  };
}

function getLog(dateKey) {
  if (!appState.logs[dateKey]) {
    appState.logs[dateKey] = createEmptyLog();
  } else {
    appState.logs[dateKey] = normalizeLog(appState.logs[dateKey]);
  }
  return appState.logs[dateKey];
}

function getLogSnapshot(dateKey) {
  return appState.logs[dateKey] ? normalizeLog(appState.logs[dateKey]) : createEmptyLog();
}

function persistState({ markDirty = true, scheduleSync = true } = {}) {
  appState.meta.schemaVersion = APP_SCHEMA_VERSION;
  if (markDirty) {
    appState.meta.lastModifiedAt = new Date().toISOString();
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  if (scheduleSync) {
    scheduleCloudSync();
  }
}

function getLogMinutes(log) {
  return DEFAULT_TASKS.reduce((sum, task) => sum + log.tasks[task.id].minutes, 0);
}

function getLogCompletion(log) {
  const total = DEFAULT_TASKS.reduce((sum, task) => {
    const taskState = log.tasks[task.id];
    const ratio = taskState.done ? 1 : Math.min(taskState.minutes / task.target, 1);
    return sum + ratio;
  }, 0);
  return Math.round((total / DEFAULT_TASKS.length) * 100);
}

function getTotalMinutes() {
  return Object.values(appState.logs).reduce((sum, log) => sum + getLogMinutes(log), 0);
}

function getCheckedInCount() {
  return Object.values(appState.logs).filter((log) => log.checkedIn).length;
}

function getRecentCheckedInDays(days) {
  let count = 0;
  for (let i = 0; i < days; i += 1) {
    const key = shiftDate(todayKey(), -i);
    if (appState.logs[key]?.checkedIn) {
      count += 1;
    }
  }
  return count;
}

function getCurrentStreak() {
  let streak = 0;
  let key = todayKey();

  while (appState.logs[key]?.checkedIn) {
    streak += 1;
    key = shiftDate(key, -1);
  }

  return streak;
}

function getRecentDateKeys(days) {
  const keys = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    keys.push(shiftDate(todayKey(), -i));
  }
  return keys;
}

function getCompletionLevel(completion) {
  if (completion >= 95) {
    return 4;
  }
  if (completion >= 70) {
    return 3;
  }
  if (completion >= 40) {
    return 2;
  }
  if (completion > 0) {
    return 1;
  }
  return 0;
}

function hasMeaningfulState(state) {
  if (state.customResources.length > 0) {
    return true;
  }

  if (state.settings.displayName !== DEFAULT_SETTINGS.displayName || state.settings.goalMinutes !== DEFAULT_SETTINGS.goalMinutes) {
    return true;
  }

  return Object.values(state.logs).some((log) => {
    if (log.checkedIn || log.focus || log.reflection) {
      return true;
    }
    return Object.values(log.tasks).some((task) => task.done || task.minutes > 0 || task.note);
  });
}

function todayKey() {
  return formatKey(new Date());
}

function shiftDate(dateKey, deltaDays) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + deltaDays);
  return formatKey(date);
}

function formatKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLongDate(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(date);
}

function formatShortDate(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
}

function formatDateTime(value) {
  const ms = parseTimestamp(value);
  if (!ms) {
    return "未记录";
  }
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
}

function parseTimestamp(value) {
  const ms = Date.parse(value || "");
  return Number.isFinite(ms) ? ms : 0;
}

function clonePlainObject(value) {
  return JSON.parse(JSON.stringify(value));
}

function showToast(message) {
  if (!els.toast) {
    return;
  }
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 2200);
}

function readableError(error) {
  if (error?.message) {
    return error.message;
  }
  return "发生未知错误，请检查 Supabase 配置和表结构。";
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(text) {
  return escapeHtml(text);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toPositiveNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function cryptoRandomId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `resource-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
