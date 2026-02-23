// ========== Sidebar & Project Selection ==========

async function showProjectSelector() {
    const res = await fetch("/api/projects");
    if (!res.ok) return;
    const projects = await res.json();
    if (projects.length === 0) {
        document.getElementById("projectList").innerHTML =
            '<p style="color:#e74c3c">No projects available. Contact your administrator.</p>';
        document.getElementById(
            "projectSelectorOverlay",
        ).style.display = "flex";
        return;
    }
    if (projects.length === 1) {
        // Auto-select
        await selectProject(projects[0].id);
        return;
    }
    const listEl = document.getElementById("projectList");
    listEl.innerHTML = "";
    for (const p of projects) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
            "block w-full px-4 py-3.5 text-left bg-slate-50 border-2 border-slate-200 rounded-xl cursor-pointer text-base font-medium text-slate-800 hover:border-indigo-500 hover:bg-indigo-50 transition-colors";
        btn.innerHTML = `<strong>${escapeHtml(p.name)}</strong>${p.subtitle ? `<br><small class="text-sm font-normal text-slate-400 mt-0.5 block">${escapeHtml(p.subtitle)}</small>` : ""}`;
        btn.addEventListener("click", () => selectProject(p.id));
        listEl.appendChild(btn);
    }
    document.getElementById(
        "projectSelectorOverlay",
    ).style.display = "flex";
}

async function selectProject(projectId) {
    const r = await fetch(`/api/projects/select/${projectId}`, {
        method: "POST",
    });
    if (!r.ok) {
        alert("Failed to select project");
        return;
    }
    const data = await r.json();
    currentUser.currentProjectId = data.projectId;
    currentUser.currentProjectRole = data.projectRole;
    currentUser.currentProjectName = data.projectName;
    document.title = data.projectName + " - vBudget";
    document.getElementById(
        "projectSelectorOverlay",
    ).style.display = "none";
    await loadProjectData();
}

function openMenu() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("sidebarOverlay").classList.add("open");
    document.body.style.overflow = "hidden";
}

function closeMenu() {
    document.getElementById("sidebar").classList.remove("open");
    document
        .getElementById("sidebarOverlay")
        .classList.remove("open");
    document.body.style.overflow = "";
}

async function updateSidebar(
    isAdmin,
    isOwner,
    version,
    projectTitle,
) {
    // User info
    document.getElementById("sidebarEmail").textContent =
        currentUser.email || "";
    const roleLabel = currentUser.superAdmin
        ? "Super Admin"
        : currentUser.currentProjectRole === "owner"
          ? "Owner"
          : isAdmin
            ? "Admin"
            : "Member";
    document.getElementById("sidebarRole").textContent = roleLabel;
    // Version
    if (version)
        document.getElementById("sidebarVersion").textContent =
            "v" + version;
    // Sidebar title = project title (or fallback)
    document.getElementById("sidebarTitle").textContent =
        projectTitle || "vBudget";
    // Update persistent header bar user info
    const headerEmail = document.getElementById("headerUserEmail");
    const headerRole = document.getElementById("headerUserRole");
    if (headerEmail) headerEmail.textContent = currentUser.email || "";
    if (headerRole) headerRole.textContent = roleLabel;
    // Admin section visibility (already handled by .admin-only class toggle)
    // V-Geld balance in sidebar
    try {
        const vgeldRes = await fetch("/api/vgeld/balance");
        if (vgeldRes.ok) {
            const vgeldData = await vgeldRes.json();
            const vgeldEl = document.getElementById("sidebarVGeld");
            if (
                vgeldData.balance !== undefined &&
                vgeldData.balance !== 0
            ) {
                vgeldEl.textContent =
                    "V-Geld: " + formatCurrency(vgeldData.balance);
                vgeldEl.style.display = "";
            } else {
                vgeldEl.style.display = "none";
            }
        }
    } catch (e) {
        document.getElementById("sidebarVGeld").style.display =
            "none";
    }
    // Telegram link button: show if project has Telegram enabled
    try {
        const tgStatus = await (
            await fetch("/api/telegram/status")
        ).json();
        const tgBtn = document.getElementById("sidebarTelegramBtn");
        if (tgStatus.enabled) {
            tgBtn.style.display = "";
            tgBtn.textContent = tgStatus.linked
                ? "Telegram: verknüpft \u2713"
                : "Telegram verknüpfen";
            tgBtn.style.color = tgStatus.linked ? "#27ae60" : "";
        } else {
            tgBtn.style.display = "none";
        }
    } catch (e) {
        document.getElementById(
            "sidebarTelegramBtn",
        ).style.display = "none";
    }
    // Project list — always show if user has projects
    try {
        const projects = await (
            await fetch("/api/projects")
        ).json();
        const section = document.getElementById(
            "sidebarProjectsSection",
        );
        section.style.display = "";
        document.getElementById("sidebarProjectList").innerHTML =
            projects
                .map((p) => {
                    const active =
                        p.id === currentUser.currentProjectId;
                    const isDefault =
                        p.id === currentUser.defaultProjectId;
                    return `<button class="block w-full text-left px-5 py-2.5 text-sm cursor-pointer transition-colors bg-transparent border-none ${active ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}" style="display:flex;align-items:center;justify-content:space-between" onclick="sidebarSelectProject(${p.id})"><span>${active ? "\u25B8 " : ""}${escapeHtml(p.name)}</span><span class="sidebar-default-star" title="${isDefault ? "Default project" : "Set as default"}" onclick="event.stopPropagation();sidebarToggleDefault(${p.id},${isDefault})" style="opacity:${isDefault ? "1" : "0.3"};cursor:pointer;font-size:14px">${isDefault ? "\u2605" : "\u2606"}</span></button>`;
                })
                .join("");
    } catch (e) {
        /* ignore */
    }
}

async function sidebarSelectProject(projectId) {
    closeMenu();
    if (projectId === currentUser.currentProjectId) return;
    const r = await fetch("/api/projects/select/" + projectId, {
        method: "POST",
    });
    if (!r.ok) {
        alert("Failed to select project");
        return;
    }
    const data = await r.json();
    currentUser.currentProjectId = data.projectId;
    currentUser.currentProjectRole = data.projectRole;
    currentUser.currentProjectName = data.projectName;
    document.title = data.projectName + " - vBudget";
    await loadProjectData();
}

async function sidebarToggleDefault(projectId, isCurrentlyDefault) {
    const newDefault = isCurrentlyDefault ? null : projectId;
    const r = await fetch("/api/user/default-project", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: newDefault }),
    });
    if (r.ok) {
        currentUser.defaultProjectId = newDefault;
        const isAdmin =
            currentUser.superAdmin ||
            ["admin", "owner"].includes(
                currentUser.currentProjectRole,
            );
        const isOwner =
            currentUser.superAdmin ||
            currentUser.currentProjectRole === "owner";
        updateSidebar(
            isAdmin,
            isOwner,
            "",
            currentUser.currentProjectName,
        );
    }
}

async function switchProject() {
    closeMenu();
    await fetch("/api/projects/clear", { method: "POST" });
    currentUser.currentProjectId = null;
    currentUser.currentProjectRole = null;
    currentUser.currentProjectName = null;
    await showProjectSelector();
}
