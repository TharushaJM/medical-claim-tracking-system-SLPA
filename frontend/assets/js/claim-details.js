document.addEventListener("DOMContentLoaded", async () => {
    const message = document.getElementById("claimsMessage");

    const showMessage = (text, type = "error") => {
        message.textContent = text;
        message.className   = `claims-message ${type}`;
    };

    /* ── Auth guard ─────────────────────────────────────────────── */
    let access;
    try {
        access = JSON.parse(sessionStorage.getItem("employeeAccess"));
    } catch {
        access = null;
    }
    if (!access?.computer_number || !access?.nic) {
        window.location.replace("access.html");
        return;
    }

    /* ── Read claim_id from URL ──────────────────────────────────── */
    const params  = new URLSearchParams(window.location.search);
    const claimId = parseInt(params.get("id"), 10);

    if (!claimId || claimId <= 0) {
        showMessage("No valid claim ID provided.");
        return;
    }

    /* ── Helpers ─────────────────────────────────────────────────── */
    const formatAmount = (amount) =>
        new Intl.NumberFormat("en-LK", {
            style: "currency",
            currency: "LKR",
            minimumFractionDigits: 2
        }).format(Number(amount) || 0);

    const formatDate = (value) => {
        if (!value) return "—";
        const d = new Date(value.replace(" ", "T"));
        return Number.isNaN(d.getTime()) ? value : d.toISOString().slice(0, 10);
    };

    /* Status badge colours */
    const STATUS_CONFIG = {
        "Paid":               { bg: "#d4edda", color: "#1a6830", border: "#a3d4b0" },
        "Submitted to Doctor":{ bg: "#e8e8e8", color: "#555555", border: "#cccccc" },
        "Document Needed":    { bg: "#fff0d4", color: "#9a5700", border: "#f5c87a" },
        "Rejected by Doctor": { bg: "#fddede", color: "#a22424", border: "#f5aaaa" },
        "Submitted":          { bg: "#e8f0f8", color: "#0b3d71", border: "#b0c8e8" },
        "Received Document":  { bg: "#e8f0f8", color: "#0b3d71", border: "#b0c8e8" },
        "Approved by Doctor": { bg: "#d4edda", color: "#1a6830", border: "#a3d4b0" },
        "Payment Approved":   { bg: "#d4edda", color: "#1a6830", border: "#a3d4b0" },
    };

    /* All possible steps in order */
    const ALL_STEPS = [
        "Submitted",
        "Received Document",
        "Document Needed",
        "Submitted to Doctor",
        "Approved by Doctor",
        "Rejected by Doctor",
        "Payment Approved",
        "Paid",
    ];

    /* ── Fetch claim detail ───────────────────────────────────────── */
    try {
        // Correct filename: employee_claim_details.php (with 's')
        const response = await fetch("../../backend/api/employee/employee_claim_details.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                computer_number: access.computer_number,
                nic: access.nic,
                claim_id: claimId          // backend expects claim_id integer
            })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Unable to load claim details.");
        }

        const claim   = result.data?.claim   || {};
        const history = result.data?.history  || [];
        renderDetail(claim, history);
    } catch (err) {
        showMessage(err.message || "Could not load claim details. Please try again.");
    }

    /* ── Render ──────────────────────────────────────────────────── */
    function renderDetail(claim, history) {
        const status = claim.status || "Submitted";

        /* Title + status badge */
        document.getElementById("detailTitle").textContent = `Claim ${claim.reference || "#" + claimId}`;
        document.title = `Claim ${claim.reference || claimId} | SLPA Medical Claims`;

        const badge = document.getElementById("detailStatusBadge");
        badge.textContent = status;
        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["Submitted"];
        badge.style.background  = cfg.bg;
        badge.style.color       = cfg.color;
        badge.style.border      = `1px solid ${cfg.border}`;

        /* Info fields — map DB column names from backend */
        setText("dRef",     claim.reference   || "—");
        setText("dOpdDate", formatDate(claim.opd_date));
        setText("dAmount",  formatAmount(claim.amount_requested));
        setText("dType",    claim.claim_type ? capitalize(claim.claim_type) : "—");

        // claim_for: "Self" or dependent name → display as "Myself" or the name
        const toWhom = claim.claim_for === "Self" ? "Myself" : (claim.claim_for || "Myself");
        setText("dToWhom",  toWhom);
        setText("dPatient", claim.patient_name || "—");

        /* Latest remark — use medical_remark field from DB */
        const latestRemark = getLatestRemark(history, claim.medical_remark);
        setText("dRemark", latestRemark || "No remarks yet.");

        /* Timeline */
        buildTimeline(status, history);
    }

    /* Get the most recent remark from history, fallback to claim's medical_remark */
    function getLatestRemark(history, fallbackRemark) {
        if (history && history.length > 0) {
            // Find the last history entry that has a non-empty remark
            for (let i = history.length - 1; i >= 0; i--) {
                if (history[i].remarks && history[i].remarks.trim() !== "") {
                    return history[i].remarks;
                }
            }
        }
        return fallbackRemark || null;
    }

    function buildTimeline(status, history = []) {
        const currentIdx = ALL_STEPS.indexOf(status);
        const timeline   = document.getElementById("timelineList");
        timeline.replaceChildren();

        const historyByStatus = history.reduce((map, item) => {
            const statusName = item.new_status_name || item.new_status || "";
            if (!statusName) return map;
            if (!map.has(statusName)) map.set(statusName, []);
            map.get(statusName).push(item);
            return map;
        }, new Map());

        const steps = [...ALL_STEPS];
        historyByStatus.forEach((_, statusName) => {
            if (!steps.includes(statusName)) steps.push(statusName);
        });

        steps.forEach((step, i) => {
            const li         = document.createElement("li");
            const isCurrent  = step === status;
            const stepHistory = historyByStatus.get(step) || [];
            const isDone     = stepHistory.length > 0 || (currentIdx >= 0 && i <= currentIdx);

            li.className = "timeline-item"
                + (isDone    ? " timeline-done"    : "")
                + (isCurrent ? " timeline-current" : "");

            /* Icon circle */
            const icon = document.createElement("span");
            icon.className = "timeline-icon"
                + (isCurrent ? " timeline-icon--current"
                   : isDone  ? " timeline-icon--done"
                   : "");

            if (isDone) {
                icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2"
                          stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`;
            }

            /* Label */
            const labelWrap = document.createElement("div");
            labelWrap.className = "timeline-content";

            const name = document.createElement("span");
            name.className   = "timeline-step-name";
            name.textContent = step;
            labelWrap.append(name);

            if (stepHistory.length > 0) {
                stepHistory.forEach(entry => {
                    const meta = document.createElement("span");
                    meta.className = "timeline-step-sub";
                    meta.textContent = formatTimelineMeta(entry);
                    labelWrap.append(meta);

                    if (entry.remarks && entry.remarks.trim() !== "") {
                        const remark = document.createElement("span");
                        remark.className = "timeline-step-remark";
                        remark.textContent = entry.remarks;
                        labelWrap.append(remark);
                    }
                });
            } else if (isCurrent) {
                const sub = document.createElement("span");
                sub.className   = "timeline-step-sub";
                sub.textContent = "Current status";
                labelWrap.append(sub);
            }

            li.append(icon, labelWrap);
            timeline.append(li);
        });
    }

    function formatTimelineMeta(entry) {
        const from = entry.old_status_name || entry.old_status || "";
        const to = entry.new_status_name || entry.new_status || "";
        const changedBy = entry.updated_by_name || entry.updated_by || "Admin";
        const changedAt = formatDateTime(entry.updated_at);
        const statusChange = from && to ? `${from} to ${to}` : (to || "Status updated");
        return `${statusChange} by ${changedBy} on ${changedAt}`;
    }

    function formatDateTime(value) {
        if (!value) return "date not available";
        const d = new Date(value.replace(" ", "T"));
        if (Number.isNaN(d.getTime())) return value;
        return new Intl.DateTimeFormat("en-LK", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }).format(d);
    }

    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    function capitalize(str) {
        return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "—";
    }
});
