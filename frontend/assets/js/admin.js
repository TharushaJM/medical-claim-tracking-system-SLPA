"use strict";

/* Always call PHP through XAMPP Apache. This also works when the HTML is previewed in Live Server. */
const ADMIN_API = `${window.location.protocol}//${window.location.hostname}/medical-claim-tracking-system-SLPA/backend/api/admin/`;

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
    if (document.getElementById("adminLoginForm")) initLoginPage();
    if (document.getElementById("dashboardContent")) initDashboardPage();
    if (document.getElementById("claimsPage")) initClaimsPage();
    if (document.getElementById("claimDetailsPage")) initClaimDetailsPage();
});

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
    document.getElementById("successModalOkBtn")?.addEventListener("click", () => window.location.assign("dashboard.html"));
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
    document.querySelectorAll(".profile-name").forEach(el => { el.textContent = `Welcome, ${name}`; });
    document.querySelectorAll(".topbar-avatar").forEach(el => { el.textContent = name.charAt(0).toUpperCase(); });
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
        setupLogout();
        setupDashboardNavigation();
        const data = await apiRequest("dashboard.php");
        renderDashboard(data);
        document.getElementById("refreshBtn")?.addEventListener("click", async () => renderDashboard(await apiRequest("dashboard.php")));
        setupDashboardSearch();
    } catch (error) { console.error(error); }
}

function setupDashboardNavigation() {
    document.getElementById("nav-claims")?.addEventListener("click", () => window.location.assign("claims.html"));
    document.getElementById("nav-details")?.addEventListener("click", () => window.location.assign("claims.html"));
    document.getElementById("viewAllRecentBtn")?.addEventListener("click", () => window.location.assign("claims.html"));
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
    if (!body) { window.location.assign(`claim-details.html?claim_id=${encodeURIComponent(claimId)}`); return; }
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
        window.location.assign(`claims.html?${params.toString()}`);
    });
    document.getElementById("resetBtn")?.addEventListener("click", () => document.querySelectorAll(".search-section input, .search-section select").forEach(input => { input.value = ""; }));
}

async function initClaimsPage() {
    try {
        setProfile(await requireAdminSession());
        setupLogout();
        const params = new URLSearchParams(window.location.search);
        const data = await apiRequest(`admin_claims.php?${params.toString()}`);
        const tbody = document.getElementById("claimsTbody");
        const claims = data.claims || [];
        tbody.innerHTML = claims.length ? claims.map(claim => `<tr><td>${escapeHtml(claim.reference_no)}</td><td>${escapeHtml(claim.computer_no)}</td><td>${escapeHtml(claim.employee_name)}</td><td>${escapeHtml(displayClaimType(claim.claim_type))}</td><td>${escapeHtml(claim.opd_date)}</td><td>${formatLKR(claim.amount_requested)}</td><td><span class="badge ${badgeClass(claim.status_name)}">${escapeHtml(claim.status_name)}</span></td><td><a class="view-btn" href="claim-details.html?claim_id=${Number(claim.claim_id)}">View →</a></td></tr>`).join("") : '<tr><td colspan="8" class="empty-state">No claims found.</td></tr>';
        document.getElementById("claimsCount").textContent = `${data.pagination.total_records} claim(s) found`;
    } catch (error) { console.error(error); }
}

async function initClaimDetailsPage() {
    try {
        setProfile(await requireAdminSession());
        setupLogout();
        const claimId = new URLSearchParams(window.location.search).get("claim_id");
        if (!claimId) throw new Error("No claim was selected.");
        const data = await apiRequest(`admin_claim_details.php?claim_id=${encodeURIComponent(claimId)}`);
        const claim = data.claim;
        document.getElementById("claimDetailsTitle").textContent = `Claim ${claim.reference_no}`;
        document.getElementById("claimDetailsBody").innerHTML = Object.entries({ "Reference No": claim.reference_no, "Employee": claim.employee_name, "Computer No": claim.computer_no, "NIC": claim.nic, "Division": claim.division, "Claim Type": displayClaimType(claim.claim_type), "OPD Date": claim.opd_date, "Requested Amount": formatLKR(claim.amount_requested), "Status": claim.current_status_name, "Patient": claim.patient_name }).map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("");
        document.getElementById("historyBody").innerHTML = (data.history || []).map(item => `<tr><td>${escapeHtml(item.old_status)}</td><td>${escapeHtml(item.new_status)}</td><td>${escapeHtml(item.remarks)}</td><td>${escapeHtml(item.updated_by)}</td><td>${escapeHtml(item.updated_at)}</td></tr>`).join("") || '<tr><td colspan="5" class="empty-state">No status history is available.</td></tr>';
    } catch (error) { document.getElementById("claimDetailsError").textContent = error.message; }
}
