// ========== Admin ==========

var admPositionsCache = [];

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
    const res = await apiFetch("/api/admin/position/" + id, {
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
    const res = await apiFetch("/api/admin/position/" + id, {
        method: "DELETE",
    });
    const j = await res.json();
    if (j.ok) {
        msg("admPositionResult", "Deleted", false);
        admLoadPositions().then(() => admLoadMembers());
    } else msg("admPositionResult", j.error || "Error", true);
}

async function admSetMemberPosition(memberId, positionId) {
    const res = await apiFetch(
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
    const res = await apiFetch(
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
    const res = await apiFetch("/api/admin/project/members/" + id, {
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
    const res = await apiFetch("/api/project", { method: "DELETE" });
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
        const res = await apiFetch("/api/admin/export/google-sheet", {
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
            const role = currentUser?.superAdmin ? "owner" : p.project_role;
            const roleLabel = role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Member";
            const isOwner = role === "owner";
            const canDelete = isOwner && p.member_count <= 1;
            const safeName = escapeHtml(p.name).replace(/'/g, "\\'");
            return `<tr class="${isActive ? "bg-indigo-50/50" : ""}">
                <td class="px-3 py-3 font-medium text-slate-800">${escapeHtml(p.name)}${isActive ? ' <span class="text-[0.65rem] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">Active</span>' : ""}</td>
                <td class="px-3 py-3 text-slate-500">${escapeHtml(p.subtitle || "—")}</td>
                <td class="px-3 py-3 text-slate-600">${escapeHtml(roleLabel)}</td>
                <td class="px-3 py-3 flex gap-2 flex-wrap">
                    ${!isActive ? `<button class="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors border-none cursor-pointer" onclick="sidebarSelectProject(${p.id})">Switch</button>` : ""}
                    ${!isOwner ? `<button class="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors border-none cursor-pointer" onclick="admResignProject(${p.id})">Resign</button>` : ""}
                    ${canDelete ? `<button class="text-xs bg-rose-600 text-white px-3 py-1.5 rounded-lg hover:bg-rose-700 transition-colors border-none cursor-pointer" onclick="admDeleteProjectById(${p.id}, '${safeName}')">Delete</button>` : ""}
                </td>
            </tr>`;
        }).join("");
    } catch (e) {
        console.error("Error loading projects overview", e);
    }
}

async function admResignProject(projectId) {
    if (!confirm("Leave this project? You will lose access.")) return;
    const res = await apiFetch(`/api/projects/${projectId}/resign`, { method: "DELETE" });
    const j = await res.json();
    if (j.ok) {
        // If we resigned from the active project, reload the page to show project selector
        if (projectId === currentUser?.currentProjectId) {
            window.location.reload();
        } else {
            admLoadProjects();
        }
    } else {
        alert(j.error || "Error resigning from project");
    }
}

async function admDeleteProjectById(projectId, projectName) {
    if (!confirm(`Delete project "${projectName}"?\n\nThis will permanently delete ALL project data. This cannot be undone.`)) return;
    const typed = prompt(`Type "${projectName}" to confirm deletion:`);
    if (typed !== projectName) {
        alert("Project name did not match. Deletion cancelled.");
        return;
    }
    const res = await apiFetch(`/api/projects/${projectId}`, { method: "DELETE" });
    const j = await res.json();
    if (j.ok) {
        alert("Project deleted.");
        if (projectId === currentUser?.currentProjectId) {
            window.location.reload();
        } else {
            admLoadProjects();
        }
    } else {
        alert(j.error || "Failed to delete project");
    }
}

// ========== Admin: AI Analysis (OCR) ==========

async function admLoadOcrSettings() {
    try {
        const settings = await (await fetch("/api/admin/settings")).json();
        document.getElementById("admOcrEnabled").checked = !!settings.ocrEnabled;
        document.getElementById("admOcrProvider").value = settings.ocrProvider || "openai";
        document.getElementById("admOcrBaseUrl").value = settings.ocrBaseUrl || "";
        document.getElementById("admOcrApiKey").value = "";

        // Show masked key if configured
        const maskedEl = document.getElementById("admOcrApiKeyMasked");
        if (settings.ocrApiKeyMasked) {
            maskedEl.textContent = "Current key: ..." + escapeHtml(settings.ocrApiKeyMasked);
        } else {
            maskedEl.textContent = "";
        }

        // Toggle base URL visibility
        admToggleOcrBaseUrl();

        // Status indicator
        const statusEl = document.getElementById("admOcrStatus");
        if (settings.ocrEnabled && settings.ocrApiKeyMasked) {
            statusEl.innerHTML = '<span class="text-emerald-600 font-medium">AI Analysis is configured and enabled</span>';
        } else if (settings.ocrEnabled) {
            statusEl.innerHTML = '<span class="text-amber-500 font-medium">Enabled but no API key configured</span>';
        } else {
            statusEl.innerHTML = '<span class="text-slate-400">AI Analysis is disabled</span>';
        }
        admLoadOcrLog();
    } catch (e) {
        console.error("Error loading OCR settings", e);
    }
}

async function admLoadOcrLog() {
    const tbody = document.getElementById("admOcrLogBody");
    try {
        const rows = await (await fetch("/api/admin/ocr-log")).json();
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-3 py-4 text-slate-400 text-center">No analysis runs yet</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map((r) => {
            const time = r.timestamp ? new Date(r.timestamp).toLocaleString() : "—";
            const bill = r.billNumber ? escapeHtml(r.billNumber) : (r.billId ? `#${r.billId}` : "—");
            const provider = escapeHtml(r.provider || "—");
            const statusBadge = r.status === "done"
                ? '<span class="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">done</span>'
                : r.status === "failed"
                ? '<span class="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">failed</span>'
                : '<span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">' + escapeHtml(r.status || "—") + '</span>';
            const fields = r.fieldsWritten && r.fieldsWritten.length
                ? escapeHtml(r.fieldsWritten.join(", "))
                : "—";
            const hasDetail = r.aiResponsePreview || r.errorDetail;
            const detailBtn = hasDetail
                ? `<button class="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer bg-transparent border-none" onclick="this.closest('tr').nextElementSibling.classList.toggle('hidden')">Show</button>`
                : "—";
            const detailContent = hasDetail
                ? `<tr class="hidden"><td colspan="6" class="px-3 py-3 bg-slate-50 text-xs">` +
                  (r.errorDetail ? `<div class="mb-2"><span class="font-semibold text-rose-600">Error:</span> ${escapeHtml(r.errorDetail)}</div>` : "") +
                  (r.aiResponsePreview ? `<div><span class="font-semibold text-slate-600">AI Response:</span><pre class="mt-1 whitespace-pre-wrap text-slate-500 bg-white p-2 rounded border border-slate-200 max-h-40 overflow-auto">${escapeHtml(r.aiResponsePreview)}</pre></div>` : "") +
                  `</td></tr>`
                : "";
            return `<tr class="border-b border-slate-50 hover:bg-slate-50/50">
                <td class="px-3 py-2.5 text-slate-500 whitespace-nowrap">${time}</td>
                <td class="px-3 py-2.5 font-medium">${bill}</td>
                <td class="px-3 py-2.5">${provider}</td>
                <td class="px-3 py-2.5">${statusBadge}</td>
                <td class="px-3 py-2.5 text-slate-600">${fields}</td>
                <td class="px-3 py-2.5">${detailBtn}</td>
            </tr>${detailContent}`;
        }).join("");
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-3 py-4 text-rose-500 text-center">Error loading log</td></tr>';
        console.error("Error loading OCR log", e);
    }
}

function admToggleOcrBaseUrl() {
    const provider = document.getElementById("admOcrProvider").value;
    document.getElementById("admOcrBaseUrlLabel").style.display =
        provider === "custom" ? "" : "none";
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
    const res = await apiFetch("/api/admin/telegram/links/" + id, {
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
        const res = await apiFetch("/api/admin/position", {
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
        const res = await apiFetch("/api/admin/project/members", {
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
        const res = await apiFetch("/api/admin/settings", {
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
        const res = await apiFetch("/api/admin/google-credentials", {
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
        const res = await apiFetch("/api/admin/settings", {
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

    // AI Analysis provider change
    document.getElementById("admOcrProvider").addEventListener("change", admToggleOcrBaseUrl);

    // AI Analysis form
    document.getElementById("admOcrForm").onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            ocrEnabled: document.getElementById("admOcrEnabled").checked,
            ocrProvider: document.getElementById("admOcrProvider").value,
            ocrBaseUrl: document.getElementById("admOcrBaseUrl").value,
        };
        // Only send API key if user typed a new one
        const keyVal = document.getElementById("admOcrApiKey").value;
        if (keyVal) {
            payload.ocrApiKey = keyVal;
        }
        const res = await apiFetch("/api/admin/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const j = await res.json();
        if (j.ok) {
            msg("admOcrResult", "AI Analysis settings saved", false);
            admLoadOcrSettings();
        } else {
            msg("admOcrResult", j.error || "Error", true);
        }
    };

    document.getElementById("admTelegramForm").onsubmit = async (e) => {
        e.preventDefault();
        const res = await apiFetch("/api/admin/settings", {
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
        const res = await apiFetch("/api/user/password", {
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
        const res = await apiFetch("/api/projects", {
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
