// ========== Notifications ==========

let notificationsData = [];

async function loadNotifications() {
    try {
        notificationsData = await fetch("/api/notifications").then((r) => r.json());
        const unread = notificationsData.filter((n) => !n.is_read).length;
        const bell = document.getElementById("notificationBellBtn");
        const badge = document.getElementById("notificationBadge");
        if (bell) bell.style.display = "";
        if (badge) {
            if (unread > 0) {
                badge.textContent = unread > 99 ? "99+" : unread;
                badge.style.display = "";
            } else {
                badge.style.display = "none";
            }
        }
        renderNotificationList();
    } catch (e) { /* ignore */ }
}

function renderNotificationList() {
    const list = document.getElementById("notificationList");
    if (!list) return;
    if (!notificationsData.length) {
        list.innerHTML = '<p class="text-sm text-slate-400 text-center py-6">No notifications</p>';
        return;
    }
    list.innerHTML = notificationsData.map((n) => `
        <div class="flex items-start gap-3 px-4 py-3 ${n.is_read ? "opacity-50" : "bg-indigo-50/40"} hover:bg-slate-50 cursor-pointer" onclick="handleNotificationClick(${n.id}, ${n.project_id || "null"})">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-slate-800 leading-snug">${escapeHtml(n.message)}</p>
                <p class="text-[0.65rem] text-slate-400 mt-0.5">${new Date(n.created_at).toLocaleString()}</p>
            </div>
            ${!n.is_read ? '<span class="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0"></span>' : ""}
        </div>
    `).join("");
}

async function handleNotificationClick(id, projectId) {
    // Mark as read
    await apiFetch(`/api/notifications/${id}/read`, { method: "POST" });
    const n = notificationsData.find((x) => x.id === id);
    if (n) n.is_read = 1;
    renderNotificationList();
    const unread = notificationsData.filter((x) => !x.is_read).length;
    const badge = document.getElementById("notificationBadge");
    if (badge) {
        badge.textContent = unread > 99 ? "99+" : unread;
        badge.style.display = unread > 0 ? "" : "none";
    }
    // Switch to that project if different
    if (projectId && projectId !== currentUser?.currentProjectId) {
        document.getElementById("notificationDropdown").style.display = "none";
        await sidebarSelectProject(projectId);
    }
}

async function markAllNotificationsRead() {
    await apiFetch("/api/notifications/read-all", { method: "POST" });
    notificationsData.forEach((n) => (n.is_read = 1));
    renderNotificationList();
    const badge = document.getElementById("notificationBadge");
    if (badge) badge.style.display = "none";
}

function toggleNotifications() {
    const dropdown = document.getElementById("notificationDropdown");
    if (!dropdown) return;
    const isVisible = dropdown.style.display !== "none";
    dropdown.style.display = isVisible ? "none" : "";
}

// Close notification dropdown when clicking outside
document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("notificationDropdown");
    const bell = document.getElementById("notificationBellBtn");
    if (dropdown && bell && !dropdown.contains(e.target) && !bell.contains(e.target)) {
        dropdown.style.display = "none";
    }
});
