// ========== Admin ==========

async function admLoadPositions() {
    try {
        admPositionsCache = await (
            await fetch("/api/positions")
        ).json();
        const tbody = document.getElementById("admPositionBody");
        tbody.innerHTML = admPositionsCache
            .map((p) => {
                const isMisc = p.name === "Misc";
                const safeName = escapeHtml(p.name).replace(
                    /'/g,
                    "&#39;",
                );
                return `<tr data-id="${p.id}">
                <td class="px-3 py-2.5">${escapeHtml(p.name)}</td>
                <td class="px-3 py-2.5">${
                    isMisc
                        ? ""
                        : `<button class="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition-colors border-none cursor-pointer mr-1" onclick="admRenamePosition(${p.id}, '${safeName}')">Rename</button>
                <button class="text-xs px-2.5 py-1 bg-rose-500 text-white rounded-md hover:bg-rose-600 transition-colors border-none cursor-pointer" onclick="admDeletePosition(${p.id})">Delete</button>`
                }</td>
            </tr>`;
            })
            .join("");
    } catch (e) {
        console.error("Error loading positions", e);
    }
}

async function admRenamePosition(id, oldName) {
    const newName = prompt(
        'Rename position "' + oldName + '" to:',
        oldName,
    );
    if (!newName || newName === oldName) return;
    const res = await fetch("/api/admin/position/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
    });
    const j = await res.json();
    if (j.ok) {
        msg("admPositionResult", "Position renamed", false);
        admLoadPositions().then(() => admLoadMembers());
    } else msg("admPositionResult", j.error || "Error", true);
}

async function admDeletePosition(id) {
    if (
        !confirm(
            "Delete this position? Members with this position will revert to unset.",
        )
    )
        return;
    const res = await fetch("/api/admin/position/" + id, {
        method: "DELETE",
    });
    const j = await res.json();
    if (j.ok) {
        msg("admPositionResult", "Deleted", false);
        admLoadPositions().then(() => admLoadMembers());
    } else msg("admPositionResult", j.error || "Error", true);
}

async function admSetMemberPosition(memberId, positionId) {
    const res = await fetch(
        "/api/admin/project/members/" + memberId,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                positionId: positionId
                    ? parseInt(positionId)
                    : null,
            }),
        },
    );
    const j = await res.json();
    if (!j.ok) msg("admMemberResult", j.error || "Error", true);
}

async function admSetMemberRole(memberId, projectRole) {
    const res = await fetch(
        "/api/admin/project/members/" + memberId,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectRole }),
        },
    );
    const j = await res.json();
    if (j.ok) admLoadMembers();
    else msg("admMemberResult", j.error || "Error", true);
}

async function admLoadMembers() {
    const tbody = document.getElementById("admMemberBody");
    try {
        const members = await (
            await fetch("/api/admin/project/members")
        ).json();
        const isOwner =
            currentUser.superAdmin ||
            currentUser.currentProjectRole === "owner";
        tbody.innerHTML = members
            .map((m) => {
                const posOptions =
                    '<option value="">-- None --</option>' +
                    admPositionsCache
                        .map(
                            (p) =>
                                `<option value="${p.id}" ${p.id === m.positionId ? "selected" : ""}>${escapeHtml(p.name)}</option>`,
                        )
                        .join("");
                const posSelect = `<select class="px-2 py-1 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" onchange="admSetMemberPosition(${m.id}, this.value)">${posOptions}</select>`;
                const roleSelect = `<select class="px-2 py-1 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" onchange="admSetMemberRole(${m.id}, this.value)">
                <option value="user" ${m.projectRole === "user" ? "selected" : ""}>User</option>
                <option value="admin" ${m.projectRole === "admin" ? "selected" : ""}>Admin</option>
                ${isOwner ? `<option value="owner" ${m.projectRole === "owner" ? "selected" : ""}>Owner</option>` : ""}
            </select>`;
                return `<tr>
                <td class="px-3 py-2.5">${escapeHtml(m.email)}</td>
                <td class="px-3 py-2.5">${roleSelect}</td>
                <td class="px-3 py-2.5">${posSelect}</td>
                <td class="px-3 py-2.5">
                    <button class="text-xs px-2.5 py-1 bg-rose-500 text-white rounded-md hover:bg-rose-600 transition-colors border-none cursor-pointer" onclick="admRemoveMember(${m.id}, '${escapeHtml(m.email)}')">Remove</button>
                </td>
            </tr>`;
            })
            .join("");
    } catch (e) {
        tbody.innerHTML =
            '<tr><td colspan="4" class="px-3 py-4 text-slate-400 text-center">Error loading members</td></tr>';
    }
}

async function admRemoveMember(id, email) {
    if (!confirm("Remove " + email + " from this project?")) return;
    const res = await fetch("/api/admin/project/members/" + id, {
        method: "DELETE",
    });
    const j = await res.json();
    if (j.ok) {
        msg("admMemberResult", "Member removed", false);
        admLoadMembers();
    } else msg("admMemberResult", j.error || "Error", true);
}

// ========== Admin: Settings ==========

async function admLoadSettings() {
    try {
        const [projectInfo, settings] = await Promise.all([
            fetch("/api/project-info").then((r) => r.json()),
            fetch("/api/admin/settings").then((r) => r.json()),
        ]);
        document.getElementById("admProjectTitle").value =
            projectInfo.projectName || "";
        document.getElementById("admProjectSubtitle").value =
            projectInfo.projectSubtitle || "";
        document.getElementById("admExportSheetId").value =
            settings.exportSheetId || "";
    } catch (e) {
        console.error("Error loading settings", e);
    }
}

async function admDeleteProject() {
    const name = currentUser.currentProjectName || "this project";
    if (
        !confirm(
            'Delete project "' +
                name +
                '"?\n\nThis will permanently delete ALL project data. This cannot be undone.',
        )
    )
        return;
    const typed = prompt(
        'Type "' + name + '" to confirm deletion:',
    );
    if (typed !== name) {
        alert("Project name did not match. Deletion cancelled.");
        return;
    }
    const res = await fetch("/api/project", { method: "DELETE" });
    const j = await res.json();
    if (j.ok) {
        alert("Project deleted.");
        window.location.href = "/";
    } else {
        alert(j.error || "Failed to delete project");
    }
}

// ========== Admin: Export / Google Sheets ==========

async function admLoadCredStatus() {
    try {
        const status = await (
            await fetch("/api/admin/google-credentials/status")
        ).json();
        const el = document.getElementById("admCredStatus");
        if (status.configured) {
            el.innerHTML =
                '<span class="text-emerald-600 font-medium">Credentials configured</span><br><small class="text-slate-400">Service account: ' +
                escapeHtml(status.email) +
                "</small>";
        } else {
            el.innerHTML =
                '<span class="text-amber-500 font-medium">No credentials configured</span>';
        }
    } catch (e) {
        console.error("Error loading cred status", e);
    }
    // Also load the sheet ID
    try {
        const settings = await (
            await fetch("/api/admin/settings")
        ).json();
        document.getElementById("admExportSheetId").value =
            settings.exportSheetId || "";
    } catch (e) {}
}

async function admExportGoogleSheet(btn) {
    btn.disabled = true;
    btn.textContent = "Exporting...";
    const resultEl = document.getElementById(
        "admGoogleExportResult",
    );
    resultEl.innerHTML = "";
    try {
        const res = await fetch("/api/admin/export/google-sheet", {
            method: "POST",
        });
        const j = await res.json();
        if (j.ok) {
            resultEl.innerHTML =
                '<span class="text-emerald-600 font-medium">Export complete!</span> <a href="' +
                escapeHtml(j.sheetUrl) +
                '" target="_blank" class="text-indigo-600 hover:text-indigo-700">Open Google Sheet</a>';
        } else {
            resultEl.innerHTML =
                '<span class="text-rose-600">' +
                escapeHtml(j.error || "Export failed") +
                "</span>";
        }
    } catch (e) {
        resultEl.innerHTML =
            '<span class="text-rose-600">Export failed: ' +
            escapeHtml(e.message) +
            "</span>";
    }
    btn.disabled = false;
    btn.textContent = "Export Now";
}

// ========== Admin: Projects Overview ==========

async function admLoadProjects() {
    try {
        const projects = await fetch("/api/projects").then((r) => r.json());
        const tbody = document.getElementById("admProjectsBody");
        if (!tbody) return;
        if (!projects.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-3 py-4 text-sm text-slate-400 text-center">No projects found</td></tr>';
            return;
        }
        tbody.innerHTML = projects.map((p) => {
            const isActive = p.id === currentUser?.currentProjectId;
            const roleLabel = currentUser?.superAdmin ? "Super Admin" : p.project_role === "owner" ? "Owner" : p.project_role === "admin" ? "Admin" : "Member";
            return `<tr class="${isActive ? "bg-indigo-50/50" : ""}">
                <td class="px-3 py-3 font-medium text-slate-800">${escapeHtml(p.name)}${isActive ? ' <span class="text-[0.65rem] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">Active</span>' : ""}</td>
                <td class="px-3 py-3 text-slate-500">${escapeHtml(p.subtitle || "—")}</td>
                <td class="px-3 py-3 text-slate-600">${escapeHtml(roleLabel)}</td>
                <td class="px-3 py-3">
                    ${!isActive ? `<button class="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors border-none cursor-pointer" onclick="sidebarSelectProject(${p.id})">Switch</button>` : ""}
                </td>
            </tr>`;
        }).join("");
    } catch (e) {
        console.error("Error loading projects overview", e);
    }
}

// ========== Admin: Telegram ==========

async function admLoadTelegramSettings() {
    try {
        const settings = await (
            await fetch("/api/admin/settings")
        ).json();
        document.getElementById("admTgEnabled").checked =
            !!settings.telegramEnabled;
        document.getElementById("admTgBotToken").value =
            settings.telegramBotToken || "";
    } catch (e) {
        console.error("Error loading telegram settings", e);
    }
    await admLoadTgBotStatus();
    await admLoadTgLinks();
}

async function admLoadTgBotStatus() {
    try {
        const s = await (
            await fetch("/api/admin/telegram/bot-status")
        ).json();
        const el = document.getElementById("admTgBotStatus");
        el.innerHTML = s.running
            ? '<span class="text-emerald-600 font-medium">Bot is running</span>'
            : '<span class="text-slate-400">Bot not running</span>';
    } catch (e) {}
}

async function admLoadTgLinks() {
    try {
        const links = await (
            await fetch("/api/admin/telegram/links")
        ).json();
        const tbody = document.getElementById("admTgLinksBody");
        if (!links.length) {
            tbody.innerHTML =
                '<tr><td colspan="4" class="px-3 py-4 text-slate-400 text-center">No linked accounts yet</td></tr>';
            return;
        }
        tbody.innerHTML = links
            .map(
                (l) => `<tr>
            <td class="px-3 py-2.5">${escapeHtml(l.user_email)}</td>
            <td class="px-3 py-2.5 font-mono text-xs text-slate-500">${escapeHtml(l.telegram_user_id)}</td>
            <td class="px-3 py-2.5 text-xs text-slate-400">${escapeHtml(l.linked_at || "")}</td>
            <td class="px-3 py-2.5"><button class="text-xs px-2.5 py-1 bg-rose-500 text-white rounded-md hover:bg-rose-600 transition-colors border-none cursor-pointer" onclick="admUnlinkTg(${l.id})">Unlink</button></td>
        </tr>`,
            )
            .join("");
    } catch (e) {
        console.error("Error loading telegram links", e);
    }
}

async function admUnlinkTg(id) {
    if (!confirm("Unlink this Telegram account?")) return;
    const res = await fetch("/api/admin/telegram/links/" + id, {
        method: "DELETE",
    });
    const j = await res.json();
    if (j.ok) {
        msg("admTgLinksResult", "Unlinked", false);
        admLoadTgLinks();
    } else msg("admTgLinksResult", j.error || "Error", true);
}

// ========== New Project ==========

function openNewProjectModal() {
    document.getElementById("newProjectModal").style.display =
        "flex";
}

// ========== Inline Form Handlers ==========

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("admPositionForm").onsubmit = async (e) => {
        e.preventDefault();
        const f = e.target;
        const res = await fetch("/api/admin/position", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: f.name.value }),
        });
        const j = await res.json();
        if (j.ok) {
            msg("admPositionResult", "Position added", false);
            f.reset();
            admLoadPositions().then(() => admLoadMembers());
        } else msg("admPositionResult", j.error || "Error", true);
    };

    document.getElementById("admMemberForm").onsubmit = async (e) => {
        e.preventDefault();
        const f = e.target;
        const res = await fetch("/api/admin/project/members", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: f.email.value,
                projectRole: f.projectRole.value,
            }),
        });
        const j = await res.json();
        if (j.ok) {
            msg("admMemberResult", "Member added", false);
            f.reset();
            admLoadMembers();
        } else msg("admMemberResult", j.error || "Error", true);
    };

    document.getElementById("admProjectForm").onsubmit = async (e) => {
        e.preventDefault();
        const res = await fetch("/api/admin/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                projectTitle:
                    document.getElementById("admProjectTitle").value,
                projectSubtitle:
                    document.getElementById("admProjectSubtitle").value,
            }),
        });
        const j = await res.json();
        msg(
            "admProjectResult",
            j.ok ? "Project settings saved" : j.error || "Error",
            !j.ok,
        );
        if (j.ok) await loadProjectData();
    };

    document.getElementById("admCredForm").onsubmit = async (e) => {
        e.preventDefault();
        const res = await fetch("/api/admin/google-credentials", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                credentials:
                    document.getElementById("admCredJson").value,
            }),
        });
        const j = await res.json();
        if (j.ok) {
            msg(
                "admCredResult",
                "Credentials saved! Share sheet with: " + j.email,
                false,
            );
            document.getElementById("admCredJson").value = "";
            admLoadCredStatus();
        } else {
            msg("admCredResult", j.error || "Error", true);
        }
    };

    document.getElementById("admExportSheetForm").onsubmit = async (e) => {
        e.preventDefault();
        const res = await fetch("/api/admin/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                exportSheetId:
                    document.getElementById("admExportSheetId").value,
            }),
        });
        const j = await res.json();
        msg(
            "admGoogleExportResult",
            j.ok ? "Export Sheet ID saved" : j.error || "Error",
            !j.ok,
        );
    };

    document.getElementById("admTelegramForm").onsubmit = async (e) => {
        e.preventDefault();
        const res = await fetch("/api/admin/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                telegramEnabled:
                    document.getElementById("admTgEnabled").checked,
                telegramBotToken:
                    document.getElementById("admTgBotToken").value,
            }),
        });
        const j = await res.json();
        if (j.ok) {
            msg("admTgSettingsResult", "Saved", false);
            setTimeout(admLoadTgBotStatus, 1500);
        } else msg("admTgSettingsResult", j.error || "Error", true);
    };

    // ========== User Settings: Change Password ==========
    document.getElementById("changePasswordForm").onsubmit = async (e) => {
        e.preventDefault();
        const current =
            document.getElementById("currentPassword").value;
        const newPw = document.getElementById("newPassword").value;
        const confirmPw =
            document.getElementById("confirmPassword").value;
        if (newPw !== confirmPw) {
            msg("changePasswordResult", "Passwords do not match", true);
            return;
        }
        if (newPw.length < 6) {
            msg(
                "changePasswordResult",
                "Password must be at least 6 characters",
                true,
            );
            return;
        }
        const res = await fetch("/api/user/password", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                currentPassword: current,
                newPassword: newPw,
            }),
        });
        const j = await res.json();
        if (j.ok) {
            msg(
                "changePasswordResult",
                "Password updated successfully",
                false,
            );
            document.getElementById("changePasswordForm").reset();
        } else {
            msg("changePasswordResult", j.error || "Error", true);
        }
    };

    document.getElementById("newProjectForm").onsubmit = async (e) => {
        e.preventDefault();
        const name = document
            .getElementById("newProjectName")
            .value.trim();
        const subtitle = document
            .getElementById("newProjectSubtitle")
            .value.trim();
        if (!name) {
            msg("newProjectResult", "Project name required", true);
            return;
        }
        const res = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, subtitle: subtitle || null }),
        });
        const j = await res.json();
        if (j.ok) {
            document.getElementById("newProjectModal").style.display =
                "none";
            document.getElementById("newProjectForm").reset();
            // Switch to the new project
            currentUser.currentProjectId = j.id;
            currentUser.currentProjectRole = "owner";
            currentUser.currentProjectName = j.name;
            await loadProjectData();
        } else {
            msg("newProjectResult", j.error || "Error", true);
        }
    };
});
