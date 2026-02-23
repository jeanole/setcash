// ========== Super Admin ==========

let saProjects = [];
let saUsers = [];

function openSuperAdminModal() {
    document.getElementById("superAdminModal").style.display = "flex";
    document.body.style.overflow = "hidden";
    saLoadProjects();
    saLoadUsers();
}

function closeSuperAdminModal() {
    document.getElementById("superAdminModal").style.display = "none";
    document.body.style.overflow = "";
}

function switchSaTab(tab) {
    document.querySelectorAll(".sa-tab").forEach((t) => {
        const isActive = t.dataset.saTab === tab;
        t.className = `sa-tab px-4 py-2.5 text-sm font-medium border-b-2 ${isActive ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"}`;
    });
    document.querySelectorAll(".sa-tab-content").forEach((c) => (c.style.display = "none"));
    const el = document.getElementById("sa-tab-" + tab);
    if (el) el.style.display = "";
}

const saMsg = (id, text, isError) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<p class="text-sm ${isError ? "text-rose-600" : "text-emerald-600"} mt-1 mb-2">${escapeHtml(text)}</p>`;
    setTimeout(() => { el.innerHTML = ""; }, isError ? 6000 : 3000);
};

// -- Projects --
async function saLoadProjects() {
    try {
        saProjects = await fetch("/api/superadmin/projects").then((r) => r.json());
        document.getElementById("saProjectBody").innerHTML = saProjects.map((p) => `
            <tr>
                <td class="px-3 py-2.5 text-slate-500">${p.id}</td>
                <td class="px-3 py-2.5 font-medium text-slate-800">${escapeHtml(p.name)}</td>
                <td class="px-3 py-2.5 text-slate-500">${escapeHtml(p.subtitle || "")}</td>
                <td class="px-3 py-2.5 text-slate-500">${p.created_at ? new Date(p.created_at).toLocaleDateString("de-DE") : ""}</td>
                <td class="px-3 py-2.5 text-slate-500">${p.member_count}</td>
                <td class="px-3 py-2.5 flex flex-wrap gap-1">
                    <button class="text-xs px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors border-none cursor-pointer" onclick="saOpenMemberships(${p.id}, '${escapeHtml(p.name).replace(/'/g, "&#39;")}')">Members</button>
                    <button class="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors border-none cursor-pointer" onclick="saEditProject(${p.id}, '${escapeHtml(p.name).replace(/'/g, "&#39;")}', '${escapeHtml(p.subtitle || "").replace(/'/g, "&#39;")}')">Edit</button>
                    <button class="text-xs px-2.5 py-1 bg-rose-100 text-rose-700 rounded-md hover:bg-rose-200 transition-colors border-none cursor-pointer" onclick="saDeleteProject(${p.id}, '${escapeHtml(p.name).replace(/'/g, "&#39;")}')">Delete</button>
                </td>
            </tr>
        `).join("");
    } catch (e) { console.error("SA: Error loading projects", e); }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("saProjectForm").onsubmit = async (e) => {
        e.preventDefault();
        const f = e.target;
        const res = await fetch("/api/superadmin/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: f.name.value, subtitle: f.subtitle.value }),
        });
        const j = await res.json();
        if (j.ok) { saMsg("saProjectResult", "Project created (ID: " + j.id + ")", false); f.reset(); saLoadProjects(); }
        else saMsg("saProjectResult", j.error || "Error", true);
    };
    document.getElementById("saUserForm").onsubmit = async (e) => {
        e.preventDefault();
        const f = e.target;
        const res = await fetch("/api/superadmin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: f.email.value, password: f.password.value, superAdmin: f.isSuperAdmin.checked }),
        });
        const j = await res.json();
        if (j.ok) { saMsg("saUserResult", "User created", false); f.reset(); saLoadUsers(); }
        else saMsg("saUserResult", j.error || "Error", true);
    };
});

async function saEditProject(id, name, subtitle) {
    const newName = prompt("Project name:", name);
    if (newName === null) return;
    const newSub = prompt("Subtitle:", subtitle);
    if (newSub === null) return;
    const res = await fetch("/api/superadmin/projects/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, subtitle: newSub }),
    });
    const j = await res.json();
    if (j.ok) { saMsg("saProjectResult", "Updated", false); saLoadProjects(); }
    else saMsg("saProjectResult", j.error || "Error", true);
}

async function saDeleteProject(id, name) {
    if (!confirm('Delete project "' + name + '"?\n\nThis permanently deletes ALL project data.')) return;
    const res = await fetch("/api/superadmin/projects/" + id, { method: "DELETE" });
    const j = await res.json();
    if (j.ok) { saMsg("saProjectResult", "Deleted", false); saLoadProjects(); }
    else saMsg("saProjectResult", j.error || "Error", true);
}

// -- Users --
async function saLoadUsers() {
    try {
        saUsers = await fetch("/api/superadmin/users").then((r) => r.json());
        document.getElementById("saUserBody").innerHTML = saUsers.map((u) => `
            <tr>
                <td class="px-3 py-2.5 font-medium text-slate-800">${escapeHtml(u.email)}</td>
                <td class="px-3 py-2.5">
                    ${u.superAdmin ? '<span class="bg-rose-500 text-white text-[0.65rem] px-2 py-0.5 rounded-full font-semibold">SUPER ADMIN</span>' : '<span class="text-slate-400">No</span>'}
                    <button class="text-xs ml-2 px-2 py-0.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 border-none cursor-pointer" onclick="saToggleSuperAdmin('${escapeHtml(u.email).replace(/'/g, "&#39;")}', ${!u.superAdmin})">${u.superAdmin ? "Revoke" : "Grant"}</button>
                </td>
                <td class="px-3 py-2.5 text-slate-500">${u.projectCount}</td>
                <td class="px-3 py-2.5 flex flex-wrap gap-1">
                    <button class="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors border-none cursor-pointer" onclick="saResetPassword('${escapeHtml(u.email).replace(/'/g, "&#39;")}')">Reset PW</button>
                    <button class="text-xs px-2.5 py-1 bg-rose-100 text-rose-700 rounded-md hover:bg-rose-200 transition-colors border-none cursor-pointer" onclick="saDeleteUser('${escapeHtml(u.email).replace(/'/g, "&#39;")}')">Delete</button>
                </td>
            </tr>
        `).join("");
        saUpdateMemberEmailSelect();
    } catch (e) { console.error("SA: Error loading users", e); }
}

async function saToggleSuperAdmin(email, newVal) {
    const res = await fetch("/api/superadmin/users/" + encodeURIComponent(email), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ superAdmin: newVal }),
    });
    const j = await res.json();
    if (j.ok) saLoadUsers();
    else saMsg("saUserResult", j.error || "Error", true);
}

async function saResetPassword(email) {
    const pw = prompt("New password for " + email + ":");
    if (!pw) return;
    const res = await fetch("/api/superadmin/users/" + encodeURIComponent(email), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
    });
    const j = await res.json();
    if (j.ok) saMsg("saUserResult", "Password reset", false);
    else saMsg("saUserResult", j.error || "Error", true);
}

async function saDeleteUser(email) {
    if (!confirm('Delete user "' + email + '"?\n\nThis removes them from all projects.')) return;
    const res = await fetch("/api/superadmin/users/" + encodeURIComponent(email), { method: "DELETE" });
    const j = await res.json();
    if (j.ok) { saMsg("saUserResult", "Deleted", false); saLoadUsers(); }
    else saMsg("saUserResult", j.error || "Error", true);
}

// -- Memberships sub-modal --
function saOpenMemberships(projectId, projectName) {
    saCurrentProjectId = projectId;
    document.getElementById("saMembershipTitle").textContent = projectName + " — Members";
    document.getElementById("saMembershipModal").style.display = "flex";
    saLoadMemberships();
}

function closeSaMemberships() {
    document.getElementById("saMembershipModal").style.display = "none";
    saCurrentProjectId = null;
    saLoadProjects();
}

function saUpdateMemberEmailSelect() {
    const sel = document.getElementById("saMemberEmailSelect");
    if (!sel) return;
    const currentEmails = new Set(saCurrentMembers.map((m) => m.email.toLowerCase()));
    sel.innerHTML = '<option value="">-- Select user --</option>' +
        saUsers.map((u) => {
            const isMember = currentEmails.has(u.email.toLowerCase());
            return `<option value="${escapeHtml(u.email)}"${isMember ? ' style="color:#aaa"' : ""}>${escapeHtml(u.email)}${isMember ? " — already member" : ""}</option>`;
        }).join("");
}

async function saLoadMemberships() {
    if (!saCurrentProjectId) return;
    const pid = saCurrentProjectId;
    try {
        saMembershipPositions = await fetch("/api/superadmin/projects/" + pid + "/positions").then((r) => r.json());
        document.getElementById("saMemberPosSelect").innerHTML =
            '<option value="">-- No position --</option>' +
            saMembershipPositions.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
        document.getElementById("saPositionBody").innerHTML = saMembershipPositions.map((p) => {
            const isMisc = p.name === "Misc";
            return `<tr>
                <td class="px-3 py-2.5 text-slate-800">${escapeHtml(p.name)}</td>
                <td class="px-3 py-2.5">${isMisc ? "" : `
                    <button class="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 border-none cursor-pointer" onclick="saRenamePosition(${p.id}, '${escapeHtml(p.name).replace(/'/g, "&#39;")}')">Rename</button>
                    <button class="text-xs px-2.5 py-1 bg-rose-100 text-rose-700 rounded-md hover:bg-rose-200 border-none cursor-pointer" onclick="saDeletePosition(${p.id})">Delete</button>
                `}</td>
            </tr>`;
        }).join("");
    } catch (e) { console.error("SA: Error loading positions", e); }

    try {
        saCurrentMembers = await fetch("/api/superadmin/projects/" + pid + "/members").then((r) => r.json());
        const posOptions = '<option value="">-- None --</option>' +
            saMembershipPositions.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
        document.getElementById("saMemberBody").innerHTML = saCurrentMembers.map((m) => {
            const roleSelect = `<select onchange="saUpdateMemberRole(${m.id}, this.value)" class="px-2 py-1 rounded border border-slate-200 text-sm outline-none">
                <option value="user"${m.projectRole === "user" ? " selected" : ""}>User</option>
                <option value="admin"${m.projectRole === "admin" ? " selected" : ""}>Admin</option>
                <option value="owner"${m.projectRole === "owner" ? " selected" : ""}>Owner</option>
            </select>`;
            const posSelect = saMembershipPositions.length > 0
                ? `<select onchange="saUpdateMemberPosition(${m.id}, this.value)" class="px-2 py-1 rounded border border-slate-200 text-sm outline-none">` +
                  posOptions.replace(`value="${m.positionId}"`, `value="${m.positionId}" selected`) + "</select>"
                : escapeHtml(m.positionName || "—");
            return `<tr>
                <td class="px-3 py-2.5 text-slate-800">${escapeHtml(m.email)}</td>
                <td class="px-3 py-2.5">${roleSelect}</td>
                <td class="px-3 py-2.5">${posSelect}</td>
                <td class="px-3 py-2.5"><button class="text-xs px-2.5 py-1 bg-rose-100 text-rose-700 rounded-md hover:bg-rose-200 border-none cursor-pointer" onclick="saRemoveMember(${m.id}, '${escapeHtml(m.email).replace(/'/g, "&#39;")}')">Remove</button></td>
            </tr>`;
        }).join("");
        saUpdateMemberEmailSelect();
    } catch (e) { console.error("SA: Error loading members", e); }
}

async function saAddMember() {
    if (!saCurrentProjectId) return;
    const email = document.getElementById("saMemberEmailSelect").value;
    const role = document.getElementById("saMemberRoleSelect").value;
    const posId = document.getElementById("saMemberPosSelect").value;
    if (!email) return saMsg("saMemberResult", "Select a user first", true);
    const res = await fetch("/api/superadmin/projects/" + saCurrentProjectId + "/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, projectRole: role, positionId: posId ? parseInt(posId) : null }),
    });
    const j = await res.json();
    if (j.ok) { saMsg("saMemberResult", "Member added", false); saLoadMemberships(); }
    else saMsg("saMemberResult", j.error || "Error", true);
}

async function saUpdateMemberRole(memberId, role) {
    const res = await fetch("/api/superadmin/projects/" + saCurrentProjectId + "/members/" + memberId, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectRole: role }),
    });
    const j = await res.json();
    if (!j.ok) saMsg("saMemberResult", j.error || "Error", true);
}

async function saUpdateMemberPosition(memberId, positionId) {
    const res = await fetch("/api/superadmin/projects/" + saCurrentProjectId + "/members/" + memberId, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ positionId: positionId ? parseInt(positionId) : null }),
    });
    const j = await res.json();
    if (!j.ok) saMsg("saMemberResult", j.error || "Error", true);
}

async function saRemoveMember(memberId, email) {
    if (!confirm("Remove " + email + " from this project?")) return;
    const res = await fetch("/api/superadmin/projects/" + saCurrentProjectId + "/members/" + memberId, { method: "DELETE" });
    const j = await res.json();
    if (j.ok) { saMsg("saMemberResult", "Removed", false); saLoadMemberships(); }
    else saMsg("saMemberResult", j.error || "Error", true);
}

async function saAddPosition() {
    const input = document.getElementById("saPositionNameInput");
    const name = input.value.trim();
    if (!name) return saMsg("saPositionResult", "Enter a name", true);
    const res = await fetch("/api/superadmin/projects/" + saCurrentProjectId + "/positions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
    });
    const j = await res.json();
    if (j.ok) { saMsg("saPositionResult", "Added", false); input.value = ""; saLoadMemberships(); }
    else saMsg("saPositionResult", j.error || "Error", true);
}

async function saRenamePosition(posId, oldName) {
    const newName = prompt('Rename "' + oldName + '" to:', oldName);
    if (!newName || newName === oldName) return;
    const res = await fetch("/api/superadmin/projects/" + saCurrentProjectId + "/positions/" + posId, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }),
    });
    const j = await res.json();
    if (j.ok) { saMsg("saPositionResult", "Renamed", false); saLoadMemberships(); }
    else saMsg("saPositionResult", j.error || "Error", true);
}

async function saDeletePosition(posId) {
    if (!confirm("Delete this position?")) return;
    const res = await fetch("/api/superadmin/projects/" + saCurrentProjectId + "/positions/" + posId, { method: "DELETE" });
    const j = await res.json();
    if (j.ok) { saMsg("saPositionResult", "Deleted", false); saLoadMemberships(); }
    else saMsg("saPositionResult", j.error || "Error", true);
}
