"use strict";

/* Always call PHP through XAMPP Apache. This also works when the HTML is previewed in Live Server. */
const ADMIN_API = `${window.location.protocol}//${window.location.hostname}/medical-claim-tracking-system-SLPA/backend/api/admin/`;
const ADMIN_PAGE_VERSION = "v=20260701-no-cache";
const adminPage = page => `${page}${page.includes("?") ? "&" : "?"}${ADMIN_PAGE_VERSION}`;
let currentAdminProfile = { username: "Admin", role: "Wellness Admin" };

function openModal(id) { document.getElementById(id)?.classList.add("active"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("active"); }
function setupModalOverlayClose(id) {
    document.getElementById(id)?.addEventListener("click", event => {
        if (event.target.id === id) closeModal(id);
    });
}
function formatLKR(amount) {
    return "LKR " + Number(amount || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[char]);
}
function displayClaimType(type) {
    return String(type || "").toLowerCase() === "specs" ? "Spectacles" : String(type || "OPD").toUpperCase();
}
function badgeClass(status) {
    return ({
        "Submitted": "badge-submitted", "Received Document": "badge-received", "Document Needed": "badge-docneeded",
        "Submitted to Doctor": "badge-todoc", "Approved by Doctor": "badge-appdoc", "Rejected by Doctor": "badge-rejdoc",
        "Payment Approved": "badge-payapprv", "Paid": "badge-paid"
    })[status] || "badge-submitted";
}
async function apiRequest(endpoint, options = {}) {
    const { redirectOnUnauthorized = true, ...requestOptions } = options;
    const response = await fetch(ADMIN_API + endpoint, { credentials: "include", ...requestOptions });
    let result;
    try { result = await response.json(); } catch { throw new Error("The server returned an invalid response."); }
    if (response.status === 401 && redirectOnUnauthorized) {
        window.location.replace("login.html");
        throw new Error("Your session has expired.");
    }
    if (!response.ok || !result.success) throw new Error(result.message || "Request failed.");
    return result.data;
}

document.addEventListener("DOMContentLoaded", () => {
    cleanupAdminTopbar();
    if (document.getElementById("adminLoginForm")) initLoginPage();
    if (document.getElementById("dashboardContent")) initDashboardPage();
    if (document.getElementById("claimsPage")) initClaimsListPage();
    if (document.getElementById("claimDetailsPage")) initClaimDetailsPage();
});

function cleanupAdminTopbar() {
    if (!document.querySelector(".admin-app")) return;
    document.querySelectorAll(".topbar-search, .topbar-icon-btn").forEach(element => element.remove());
}

function initLoginPage() {
    const form = document.getElementById("adminLoginForm");
    const username = document.getElementById("adminUsername");
    const password = document.getElementById("adminPassword");
    const remember = document.getElementById("rememberMe");
    const savedUsername = localStorage.getItem("slpa_admin_remember_username");
    if (savedUsername) { username.value = savedUsername; remember.checked = true; }

    document.getElementById("togglePassword")?.addEventListener("click", () => {
        password.type = password.type === "password" ? "text" : "password";
    });
    document.getElementById("forgotPasswordBtn")?.addEventListener("click", () => openModal("forgotModal"));
    document.getElementById("forgotModalCloseBtn")?.addEventListener("click", () => closeModal("forgotModal"));
    document.getElementById("errorModalCloseBtn")?.addEventListener("click", () => closeModal("errorModal"));
    document.getElementById("successModalOkBtn")?.addEventListener("click", () => window.location.assign(adminPage("dashboard.html")));
    setupModalOverlayClose("forgotModal"); setupModalOverlayClose("errorModal");

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const usernameValue = username.value.trim();
        const passwordValue = password.value;
        if (!usernameValue || !passwordValue) {
            document.getElementById("errorModalMsg").textContent = "Username and password are required.";
            openModal("errorModal");
            return;
        }
        try {
            await apiRequest("admin_login.php", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: usernameValue, password: passwordValue }), redirectOnUnauthorized: false
            });
            if (remember.checked) localStorage.setItem("slpa_admin_remember_username", usernameValue);
            else localStorage.removeItem("slpa_admin_remember_username");
            openModal("successModal");
        } catch (error) {
            document.getElementById("errorModalMsg").textContent = error.message || "Unable to sign in.";
            openModal("errorModal");
        }
    });
}

async function requireAdminSession() {
    return apiRequest("admin_check_session.php");
}

function setProfile(admin) {
    const name = admin.username || "Admin";
    currentAdminProfile = { username: name, role: "Wellness Admin" };
    document.querySelectorAll(".profile-name").forEach(el => { el.textContent = `Welcome, ${name}`; });
    document.querySelectorAll(".topbar-avatar").forEach(el => { el.textContent = name.charAt(0).toUpperCase(); });
}

function ensureAdminInfoModal() {
    let modal = document.getElementById("adminInfoModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.id = "adminInfoModal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "adminInfoModalTitle");
    modal.innerHTML = `
        <div class="modal-box admin-info-modal">
            <span class="modal-icon" id="adminInfoModalIcon">i</span>
            <div class="modal-title" id="adminInfoModalTitle">Admin</div>
            <div class="modal-msg" id="adminInfoModalMsg"></div>
            <div class="modal-btn-row">
                <button class="btn-modal btn-modal-primary" id="adminInfoModalCloseBtn">OK</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("adminInfoModalCloseBtn")?.addEventListener("click", () => closeModal("adminInfoModal"));
    setupModalOverlayClose("adminInfoModal");
    return modal;
}

function showAdminInfoModal(title, message, icon = "i") {
    ensureAdminInfoModal();
    document.getElementById("adminInfoModalTitle").textContent = title;
    document.getElementById("adminInfoModalIcon").textContent = icon;
    document.getElementById("adminInfoModalMsg").innerHTML = message;
    openModal("adminInfoModal");
}

function ensureChangePasswordModal() {
    let modal = document.getElementById("changePasswordModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.id = "changePasswordModal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "changePasswordModalTitle");
    modal.innerHTML = `
        <div class="modal-box password-modal">
            <span class="modal-icon">🔐</span>
            <div class="modal-title" id="changePasswordModalTitle">Change Password</div>
            <p class="modal-msg">Enter your current password and choose a new secure password.</p>
            <form id="changePasswordForm" class="password-form">
                <div class="password-field">
                    <label for="currentPassword">Current Password</label>
                    <input id="currentPassword" type="password" autocomplete="current-password" required>
                </div>
                <div class="password-field">
                    <label for="newPassword">New Password</label>
                    <input id="newPassword" type="password" autocomplete="new-password" minlength="8" required>
                </div>
                <div class="password-field">
                    <label for="confirmPassword">Confirm New Password</label>
                    <input id="confirmPassword" type="password" autocomplete="new-password" minlength="8" required>
                </div>
                <p class="password-error" id="changePasswordError"></p>
                <div class="modal-btn-row password-actions">
                    <button class="btn-modal btn-modal-primary" id="submitChangePasswordBtn" type="submit">Update Password</button>
                    <button class="btn-modal btn-modal-outline" id="cancelChangePasswordBtn" type="button">Cancel</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    const form = document.getElementById("changePasswordForm");
    const errorBox = document.getElementById("changePasswordError");
    const submitBtn = document.getElementById("submitChangePasswordBtn");

    document.getElementById("cancelChangePasswordBtn")?.addEventListener("click", () => closeModal("changePasswordModal"));
    setupModalOverlayClose("changePasswordModal");

    form?.addEventListener("submit", async event => {
        event.preventDefault();
        errorBox.textContent = "";

        const currentPassword = document.getElementById("currentPassword").value;
        const newPassword = document.getElementById("newPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (newPassword.length < 8) {
            errorBox.textContent = "New password must be at least 8 characters.";
            return;
        }

        if (newPassword !== confirmPassword) {
            errorBox.textContent = "New password and confirm password do not match.";
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Updating...";

        try {
            await apiRequest("admin_change_password.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            });
            form.reset();
            closeModal("changePasswordModal");
            showAdminInfoModal("Password Updated", "Your admin password was changed successfully.", "✓");
        } catch (error) {
            errorBox.textContent = error.message || "Unable to update password.";
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Update Password";
        }
    });

    return modal;
}

function setupAdminTopbar() {
    const clock = document.getElementById("adminClock");
    if (clock && clock.dataset.ready !== "1") {
        const updateClock = () => {
            clock.textContent = new Date().toLocaleTimeString("en-LK", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
            });
        };
        clock.dataset.ready = "1";
        updateClock();
        setInterval(updateClock, 1000);
    }

    const profileBtn = document.getElementById("profileBtn");
    const profileMenu = profileBtn?.closest(".profile-menu");
    if (profileBtn && profileMenu && profileBtn.dataset.ready !== "1") {
        profileBtn.dataset.ready = "1";
        profileBtn.addEventListener("click", event => {
            event.stopPropagation();
            profileMenu.classList.toggle("open");
            profileBtn.setAttribute("aria-expanded", profileMenu.classList.contains("open") ? "true" : "false");
        });

        document.addEventListener("click", event => {
            if (!profileMenu.contains(event.target)) {
                profileMenu.classList.remove("open");
                profileBtn.setAttribute("aria-expanded", "false");
            }
        });
    }

    document.getElementById("viewProfileBtn")?.addEventListener("click", () => {
        profileMenu?.classList.remove("open");
        showAdminInfoModal(
            "Admin Profile",
            `<div class="profile-modal-row"><span>Username</span><strong>${escapeHtml(currentAdminProfile.username)}</strong></div>
             <div class="profile-modal-row"><span>Role</span><strong>${escapeHtml(currentAdminProfile.role)}</strong></div>`,
            "A"
        );
    });

    document.getElementById("changePasswordBtn")?.addEventListener("click", () => {
        profileMenu?.classList.remove("open");
        ensureChangePasswordModal();
        document.getElementById("changePasswordError").textContent = "";
        openModal("changePasswordModal");
        setTimeout(() => document.getElementById("currentPassword")?.focus(), 50);
    });

    document.getElementById("profileLogoutBtn")?.addEventListener("click", () => {
        profileMenu?.classList.remove("open");
        openModal("logoutModal");
    });
}

function setupSidebarToggle() {
    const toggle = document.getElementById("sidebarToggle");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const app = document.querySelector(".admin-app");
    if (!toggle || !sidebar || !app || toggle.dataset.ready === "1") return;
    toggle.dataset.ready = "1";
    toggle.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 900px)").matches) {
            sidebar.classList.toggle("open");
            overlay?.classList.toggle("active");
        } else {
            app.classList.toggle("sidebar-collapsed");
        }
    });
    overlay?.addEventListener("click", () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("active");
    });
}

function setupLogout() {
    document.getElementById("logoutBtn")?.addEventListener("click", () => openModal("logoutModal"));
    document.getElementById("cancelLogoutBtn")?.addEventListener("click", () => closeModal("logoutModal"));
    document.getElementById("confirmLogoutBtn")?.addEventListener("click", async () => {
        try { await apiRequest("admin_logout.php"); } catch (_) { /* redirect even if the server session is already gone */ }
        window.location.replace("login.html");
    });
    setupModalOverlayClose("logoutModal");
}

async function initDashboardPage() {
    try {
        setProfile(await requireAdminSession());
        setupAdminTopbar();
        setupSidebarToggle();
        setupLogout();
        setupDashboardNavigation();
        const data = await apiRequest("dashboard.php");
        renderDashboard(data);
        setupDashboardSearch();
    } catch (error) { console.error(error); }
}

function setupDashboardNavigation() {
    document.getElementById("nav-claims")?.addEventListener("click", () => window.location.assign(adminPage("claims.html")));
    document.getElementById("nav-details")?.addEventListener("click", () => window.location.assign(adminPage("claim-details.html")));
    document.getElementById("viewAllRecentBtn")?.addEventListener("click", () => window.location.assign(adminPage("claims.html")));
    document.getElementById("closeViewClaimModal")?.addEventListener("click", () => closeModal("viewClaimModal"));
    setupModalOverlayClose("viewClaimModal");
}

function renderDashboard(data) {
    const counts = Object.fromEntries((data.status_counts || []).map(item => [item.status_name, Number(item.total)]));
    const card = (label, value, cls, amount = false) => `<div class="stat-card ${cls}${amount ? " stat-card-wide" : ""}"><div class="stat-dot-row"><span class="stat-dot"></span><span class="stat-label">${label}</span></div><div class="stat-value${amount ? " amount" : ""}">${value}</div></div>`;
    document.getElementById("statsRow1").innerHTML = [
        card("Total Claims", data.total_claims || 0, "stat-total"), card("Submitted", counts.Submitted || 0, "stat-submitted"),
        card("Received Document", counts["Received Document"] || 0, "stat-received"), card("Document Needed", counts["Document Needed"] || 0, "stat-docneeded"),
        card("Submitted to Doctor", counts["Submitted to Doctor"] || 0, "stat-todoc")
    ].join("");
    document.getElementById("statsRow2").innerHTML = [
        card("Approved by Doctor", counts["Approved by Doctor"] || 0, "stat-approved"), card("Rejected by Doctor", counts["Rejected by Doctor"] || 0, "stat-rejected"),
        card("Payment Approved", counts["Payment Approved"] || 0, "stat-payapprv"), card("Paid", counts.Paid || 0, "stat-paid"),
        card("Total Paid Amount", formatLKR(data.total_paid_amount), "stat-amount", true)
    ].join("");
    renderClaimRows("recentClaimsTbody", data.recent_claims || [], true);
    renderClaimRows("actionClaimsTbody", data.claims_needing_action || [], false);
    renderBarChart(data.status_counts || []);
    renderDonutChart(data.claim_type_counts || []);
    renderPaymentSummary(data.payment_summary || {});
}

function renderClaimRows(id, claims, includeType) {
    const tbody = document.getElementById(id);
    if (!tbody) return;
    const colspan = includeType ? 8 : 7;
    if (!claims.length) { tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-state">No claims found.</td></tr>`; return; }
    tbody.innerHTML = claims.map(claim => `<tr><td class="td-ref">${escapeHtml(claim.reference_no)}</td><td class="td-comp">${escapeHtml(claim.computer_no)}</td><td>${escapeHtml(claim.employee_name)}</td>${includeType ? `<td>${escapeHtml(displayClaimType(claim.claim_type))}</td>` : ""}<td class="td-date">${escapeHtml(claim.opd_date)}</td><td class="td-amount">${formatLKR(claim.amount_requested)}</td><td><span class="badge ${badgeClass(claim.status_name)}">${escapeHtml(claim.status_name)}</span></td><td><button class="view-btn" data-claim-id="${Number(claim.claim_id)}">View →</button></td></tr>`).join("");
    tbody.querySelectorAll("[data-claim-id]").forEach(button => button.addEventListener("click", () => openClaimDetails(button.dataset.claimId)));
}

async function openClaimDetails(claimId) {
    const data = await apiRequest(`admin_claim_details.php?claim_id=${encodeURIComponent(claimId)}`);
    const claim = data.claim;
    const body = document.getElementById("viewClaimModalBody");
    if (!body) { window.location.assign(adminPage(`claim-details.html?claim_id=${encodeURIComponent(claimId)}`)); return; }
    document.getElementById("viewClaimModalTitle").textContent = `Claim: ${claim.reference_no}`;
    body.innerHTML = `<table style="width:100%; font-size:13.5px; border-collapse:collapse;"><tr><td>Reference No</td><td>${escapeHtml(claim.reference_no)}</td></tr><tr><td>Computer No</td><td>${escapeHtml(claim.computer_no)}</td></tr><tr><td>Employee Name</td><td>${escapeHtml(claim.employee_name)}</td></tr><tr><td>Claim Type</td><td>${escapeHtml(displayClaimType(claim.claim_type))}</td></tr><tr><td>OPD Date</td><td>${escapeHtml(claim.opd_date)}</td></tr><tr><td>Amount</td><td>${formatLKR(claim.amount_requested)}</td></tr><tr><td>Status</td><td>${escapeHtml(claim.current_status_name)}</td></tr></table>`;
    openModal("viewClaimModal");
}

function renderBarChart(items) {
    const container = document.getElementById("statusBarChart"); if (!container) return;
    const max = Math.max(...items.map(item => Number(item.total)), 1);
    container.innerHTML = items.map(item => `<div class="bar-row"><div class="bar-label">${escapeHtml(item.status_name)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(Number(item.total) / max * 100)}%"></div></div><div class="bar-count">${Number(item.total)}</div></div>`).join("") || "No status data available.";
}
function renderDonutChart(items) {
    const values = Object.fromEntries(items.map(item => [String(item.claim_type).toLowerCase(), Number(item.total)]));
    const opd = values.opd || 0, specs = values.specs || 0, total = opd + specs;
    document.getElementById("donutTotal").textContent = total;
    const legend = document.getElementById("donutLegend");
    if (legend) legend.innerHTML = `<div class="legend-row"><span class="legend-label">OPD</span><span class="legend-val">${opd}</span></div><div class="legend-row"><span class="legend-label">Spectacles</span><span class="legend-val">${specs}</span></div>`;
    const svg = document.getElementById("donutSvg");
    if (svg) { const pct = total ? opd / total * 100 : 0; svg.innerHTML = `<circle cx="50" cy="50" r="36" fill="none" stroke="#0d9488" stroke-width="16"/><circle cx="50" cy="50" r="36" fill="none" stroke="#1e7fd4" stroke-width="16" stroke-dasharray="${pct * 2.262} 226.2" transform="rotate(-90 50 50)"/>`; }
}
function renderPaymentSummary(summary) {
    const row = document.getElementById("paymentSummaryRow"); if (!row) return;
    row.innerHTML = `<div class="payment-stat-item"><div class="payment-stat-info"><div class="psi-label">Total Paid Amount</div><div class="psi-value">${formatLKR(summary.total_paid_amount)}</div></div></div><div class="payment-stat-item"><div class="payment-stat-info"><div class="psi-label">Pending Payment (Approved)</div><div class="psi-value">${formatLKR(summary.pending_payment_amount)}</div></div></div><div class="payment-stat-item"><div class="payment-stat-info"><div class="psi-label">Total Approved Claims Value</div><div class="psi-value">${formatLKR(summary.total_approved_amount)}</div></div></div>`;
}

function setupDashboardSearch() {
    document.getElementById("searchBtn")?.addEventListener("click", () => {
        const params = new URLSearchParams();
        const map = { searchRef: "search", searchStatus: "status", searchDivision: "division", searchDateFrom: "date_from", searchDateTo: "date_to" };
        Object.entries(map).forEach(([id, key]) => { const value = document.getElementById(id)?.value.trim(); if (value) params.set(key, value); });
        const type = document.getElementById("searchType")?.value; if (type) params.set("claim_type", type === "Spectacles" ? "specs" : type.toLowerCase());
        window.location.assign(adminPage(`claims.html?${params.toString()}`));
    });
    document.getElementById("resetBtn")?.addEventListener("click", () => document.querySelectorAll(".search-section input, .search-section select").forEach(input => { input.value = ""; }));
}

async function initClaimsPage() {
    try {
        setProfile(await requireAdminSession());
        setupAdminTopbar();
        setupLogout();
        const params = new URLSearchParams(window.location.search);
        const data = await apiRequest(`admin_claims.php?${params.toString()}`);
        const tbody = document.getElementById("claimsTbody");
        const claims = data.claims || [];
        tbody.innerHTML = claims.length ? claims.map(claim => `<tr><td>${escapeHtml(claim.reference_no)}</td><td>${escapeHtml(claim.computer_no)}</td><td>${escapeHtml(claim.employee_name)}</td><td>${escapeHtml(displayClaimType(claim.claim_type))}</td><td>${escapeHtml(claim.opd_date)}</td><td>${formatLKR(claim.amount_requested)}</td><td><span class="badge ${badgeClass(claim.status_name)}">${escapeHtml(claim.status_name)}</span></td><td><a class="view-btn" href="${adminPage(`claim-details.html?claim_id=${Number(claim.claim_id)}`)}">View →</a></td></tr>`).join("") : '<tr><td colspan="8" class="empty-state">No claims found.</td></tr>';
        document.getElementById("claimsCount").textContent = `${data.pagination.total_records} claim(s) found`;
    } catch (error) { console.error(error); }
}

async function initClaimsListPage() {
    try {
        setProfile(await requireAdminSession());
        setupAdminTopbar();
        setupSidebarToggle();
        setupLogout();
        const state = {
            page: Math.max(1, Number(new URLSearchParams(window.location.search).get("page") || 1)),
            limit: 10,
            statusesLoaded: false,
            divisionsLoaded: false
        };

        const applyQueryToFields = () => {
            const params = new URLSearchParams(window.location.search);
            document.getElementById("searchRef").value = params.get("search") || "";
            document.getElementById("searchStatus").value = params.get("status") || "";
            document.getElementById("searchType").value = params.get("claim_type") || "";
            document.getElementById("searchDivision").value = params.get("division") || "";
            document.getElementById("searchDateFrom").value = params.get("date_from") || "";
            document.getElementById("searchDateTo").value = params.get("date_to") || "";
        };

        const readFilters = () => {
            const params = new URLSearchParams();
            const search = document.getElementById("searchRef")?.value.trim();
            const status = document.getElementById("searchStatus")?.value.trim();
            const claimType = document.getElementById("searchType")?.value.trim();
            const division = document.getElementById("searchDivision")?.value.trim();
            const dateFrom = document.getElementById("searchDateFrom")?.value.trim();
            const dateTo = document.getElementById("searchDateTo")?.value.trim();
            if (search) params.set("search", search);
            if (status) params.set("status", status);
            if (claimType) params.set("claim_type", claimType);
            if (division) params.set("division", division);
            if (dateFrom) params.set("date_from", dateFrom);
            if (dateTo) params.set("date_to", dateTo);
            params.set("page", String(state.page));
            params.set("limit", String(state.limit));
            return params;
        };

        const populateStatusFilter = (statuses) => {
            if (state.statusesLoaded) return;
            const select = document.getElementById("searchStatus");
            const selected = new URLSearchParams(window.location.search).get("status") || "";
            select.innerHTML = `<option value="">All Statuses</option>${(statuses || []).filter(item => item.status_name).map(item => `<option value="${escapeHtml(item.status_name)}">${escapeHtml(item.status_name)}</option>`).join("")}`;
            select.value = selected;
            state.statusesLoaded = true;
        };

        const populateDivisionFilter = (divisions) => {
            if (state.divisionsLoaded) return;
            const select = document.getElementById("searchDivision");
            const selected = new URLSearchParams(window.location.search).get("division") || "";
            select.innerHTML = `<option value="">All Divisions</option>${(divisions || []).filter(item => item.division_name).map(item => `<option value="${escapeHtml(item.division_name)}">${escapeHtml(item.division_name)}</option>`).join("")}`;
            select.value = selected;
            state.divisionsLoaded = true;
        };

        const loadClaims = async () => {
            const params = readFilters();
            const data = await apiRequest(`admin_claims.php?${params.toString()}`);
            const claims = data.claims || [];
            const pagination = data.pagination || { current_page: 1, total_pages: 1, total_records: 0 };
            const tbody = document.getElementById("claimsTbody");

            populateStatusFilter(data.statuses || []);
            populateDivisionFilter(data.divisions || []);
            state.page = Number(pagination.current_page || 1);
            tbody.innerHTML = claims.length ? claims.map(claim => `<tr>
                <td class="td-ref">${escapeHtml(claim.reference_no)}</td>
                <td class="td-comp">${escapeHtml(claim.computer_no)}</td>
                <td>${escapeHtml(claim.nic)}</td>
                <td>${escapeHtml(claim.employee_name)}</td>
                <td>${escapeHtml(claim.division)}</td>
                <td class="td-date">${escapeHtml(claim.opd_date)}</td>
                <td class="td-amount">${formatLKR(claim.amount_requested)}</td>
                <td>${escapeHtml(displayClaimType(claim.claim_type))}</td>
                <td><span class="badge ${badgeClass(claim.status_name)}">${escapeHtml(claim.status_name)}</span></td>
                <td><a class="view-btn" href="${adminPage(`claim-details.html?claim_id=${Number(claim.claim_id)}`)}">View →</a></td>
            </tr>`).join("") : '<tr><td colspan="10" class="empty-state">No claims found.</td></tr>';

            document.getElementById("claimsCount").textContent = `${Number(pagination.total_records || 0)} claim(s) found`;
            document.getElementById("pageInfo").textContent = `Page ${Number(pagination.current_page || 1)} of ${Number(pagination.total_pages || 1)}`;
            document.getElementById("prevPageBtn").disabled = Number(pagination.current_page || 1) <= 1;
            document.getElementById("nextPageBtn").disabled = Number(pagination.current_page || 1) >= Number(pagination.total_pages || 1);
            window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
        };

        applyQueryToFields();
        document.getElementById("nav-dashboard")?.addEventListener("click", () => window.location.assign(adminPage("dashboard.html")));
        document.getElementById("nav-details")?.addEventListener("click", () => window.location.assign(adminPage("claim-details.html")));
        document.getElementById("searchBtn")?.addEventListener("click", () => { state.page = 1; loadClaims(); });
        document.getElementById("resetBtn")?.addEventListener("click", () => {
            document.querySelectorAll(".search-section input, .search-section select").forEach(input => { input.value = ""; });
            state.page = 1;
            loadClaims();
        });
        document.getElementById("prevPageBtn")?.addEventListener("click", () => { if (state.page > 1) { state.page -= 1; loadClaims(); } });
        document.getElementById("nextPageBtn")?.addEventListener("click", () => { state.page += 1; loadClaims(); });
        await loadClaims();
    } catch (error) {
        console.error(error);
        const tbody = document.getElementById("claimsTbody");
        if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="empty-state">${escapeHtml(error.message || "Failed to load claims.")}</td></tr>`;
    }
}

async function initClaimDetailsPage() {
    try {
        setProfile(await requireAdminSession());
        setupAdminTopbar();
        setupSidebarToggle();
        setupLogout();
        document.getElementById("nav-dashboard")?.addEventListener("click", () => window.location.assign(adminPage("dashboard.html")));
        document.getElementById("nav-claims")?.addEventListener("click", () => window.location.assign(adminPage("claims.html")));
        let claimId = new URLSearchParams(window.location.search).get("claim_id");
        if (!claimId) {
            const firstClaimData = await apiRequest("admin_claims.php?page=1&limit=1");
            const firstClaim = firstClaimData.claims?.[0];
            if (firstClaim?.claim_id) {
                claimId = String(firstClaim.claim_id);
                window.history.replaceState({}, "", `${window.location.pathname}?claim_id=${encodeURIComponent(claimId)}`);
            } else {
                document.getElementById("claimDetailsError").textContent = "No claims are available. Please create a claim first.";
                document.getElementById("employeeInfoBody").innerHTML = '<div class="empty-state">No claim selected.</div>';
                document.getElementById("claimInfoBody").innerHTML = '<div class="empty-state">No claim selected.</div>';
                return;
            }
        }
        const detailRows = (items) => Object.entries(items).map(([label, value]) => `
            <div class="detail-item">
                <div class="detail-label">${escapeHtml(label)}</div>
                <div class="detail-value">${escapeHtml(value || "—")}</div>
            </div>
        `).join("");
        const toDateInput = value => value ? String(value).slice(0, 10) : "";
        const toDateTimeInput = value => value ? String(value).replace(" ", "T").slice(0, 16) : "";
        const postJson = (endpoint, body) => apiRequest(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        let latestData = null;
        const loadDetails = async () => {
            latestData = await apiRequest(`admin_claim_details.php?claim_id=${encodeURIComponent(claimId)}`);
            const claim = latestData.claim;
            document.getElementById("claimDetailsTitle").textContent = `Claim ${claim.reference_no || claim.claim_id}`;
            document.getElementById("employeeInfoBody").innerHTML = detailRows({
                "Employee Name": claim.employee_name,
                "Computer Number": claim.computer_no,
                "NIC": claim.nic,
                "Division": claim.division
            });
            document.getElementById("claimInfoBody").innerHTML = detailRows({
                "Reference Number": claim.reference_no,
                "Claim Type": displayClaimType(claim.claim_type),
                "Claim For": claim.claim_for,
                "Patient Name": claim.patient_name,
                "OPD Date": claim.opd_date,
                "Requested Amount": formatLKR(claim.amount_requested),
                "Current Status": claim.current_status_name,
                "Created At": claim.created_at
            });

            document.getElementById("documentReceived").value = String(Number(claim.is_document_received || 0));
            document.getElementById("documentReceivedDate").value = toDateTimeInput(claim.document_received_date);
            document.getElementById("invoiceNumber").value = claim.invoice_number || "";
            document.getElementById("medicalRecommendation").value = claim.medical_recommendation || "PENDING";
            document.getElementById("doctorApprovedDate").value = toDateInput(claim.doctor_approved_date);
            document.getElementById("medicalRemark").value = claim.medical_remark || "";
            document.getElementById("approvedAmount").value = claim.approved_amount ?? "";
            document.getElementById("paymentApprovedDate").value = toDateInput(claim.payment_approved_date);
            document.getElementById("paidDate").value = toDateInput(claim.paid_date);

            const newStatus = document.getElementById("newStatus");
            newStatus.innerHTML = `<option value="">Select New Status</option>${(latestData.statuses || []).map(status => `
                <option value="${Number(status.status_id || 0)}" data-status-name="${escapeHtml(status.status_name)}">${escapeHtml(status.status_name)}</option>
            `).join("")}`;

            const history = latestData.history || [];
            document.getElementById("historyTimeline").innerHTML = history.length ? history.map(item => `
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-card">
                        <div class="timeline-title">${escapeHtml(item.old_status || "—")} → ${escapeHtml(item.new_status || "—")}</div>
                        <div class="timeline-meta">Updated by ${escapeHtml(item.updated_by || "Admin")} on ${escapeHtml(item.updated_at || "—")}</div>
                        <div class="timeline-remark">${escapeHtml(item.remarks || "No remark provided.")}</div>
                    </div>
                </div>
            `).join("") : '<div class="empty-state">No status history is available.</div>';
        };

        document.getElementById("documentForm")?.addEventListener("submit", async event => {
            event.preventDefault();
            await postJson("update_document.php", {
                claim_id: Number(claimId),
                is_document_received: document.getElementById("documentReceived").value,
                document_received_date: document.getElementById("documentReceivedDate").value.replace("T", " "),
                invoice_number: document.getElementById("invoiceNumber").value.trim()
            });
            await loadDetails();
            alert("Document tracking updated successfully.");
        });

        document.getElementById("medicalForm")?.addEventListener("submit", async event => {
            event.preventDefault();
            await postJson("update_medical.php", {
                claim_id: Number(claimId),
                medical_recommendation: document.getElementById("medicalRecommendation").value,
                doctor_approved_date: document.getElementById("doctorApprovedDate").value,
                medical_remark: document.getElementById("medicalRemark").value.trim()
            });
            await loadDetails();
            alert("Medical decision updated successfully.");
        });

        document.getElementById("paymentForm")?.addEventListener("submit", async event => {
            event.preventDefault();
            await postJson("update_payment.php", {
                claim_id: Number(claimId),
                approved_amount: document.getElementById("approvedAmount").value,
                payment_approved_date: document.getElementById("paymentApprovedDate").value,
                paid_date: document.getElementById("paidDate").value
            });
            await loadDetails();
            alert("Payment information updated successfully.");
        });

        document.getElementById("statusUpdateForm")?.addEventListener("submit", async event => {
            event.preventDefault();
            const selected = document.getElementById("newStatus").selectedOptions[0];
            await postJson("update_status.php", {
                claim_id: Number(claimId),
                new_status_id: Number(document.getElementById("newStatus").value || 0),
                new_status_name: selected?.dataset.statusName || selected?.textContent?.trim() || "",
                remarks: document.getElementById("statusRemark").value.trim()
            });
            document.getElementById("statusRemark").value = "";
            await loadDetails();
            alert("Claim status updated successfully.");
        });

        await loadDetails();
    } catch (error) { document.getElementById("claimDetailsError").textContent = error.message; }
}
