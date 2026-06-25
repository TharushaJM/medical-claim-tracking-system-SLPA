document.addEventListener("DOMContentLoaded", async () => {
    const tableBody   = document.getElementById("claimsTableBody");
    const emptyClaims = document.getElementById("emptyClaims");
    const message     = document.getElementById("claimsMessage");
    const employeeSummary = document.getElementById("employeeSummary");
    const totalText   = document.getElementById("claimsTotalText");
    const pageLabel   = document.getElementById("pageLabel");
    const prevBtn     = document.getElementById("prevPage");
    const nextBtn     = document.getElementById("nextPage");

    let currentPage = 1;
    const LIMIT = 10;

    const showMessage = (text, type = "error") => {
        message.textContent = text;
        message.className = `claims-message ${type}`;
    };

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

    const employeeName = access.employee?.employee_name || access.computer_number;
    employeeSummary.innerHTML = `Employee: <strong>${employeeName}</strong> · Computer No: ${access.computer_number}`;

    const formatAmount = (amount) =>
        new Intl.NumberFormat("en-LK", {
            style: "currency",
            currency: "LKR",
            minimumFractionDigits: 2
        }).format(Number(amount) || 0);

    const formatDate = (value) => {
        if (!value) return "—";
        const date = new Date(value.replace(" ", "T"));
        return Number.isNaN(date.getTime())
            ? value
            : date.toISOString().slice(0, 10); // YYYY-MM-DD
    };

    /* Status badge colours matching the image */
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

    const makeStatusBadge = (status) => {
        const badge = document.createElement("span");
        badge.className = "claim-status";
        badge.textContent = status || "Submitted";
        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["Submitted"];
        badge.style.background = cfg.bg;
        badge.style.color      = cfg.color;
        badge.style.border     = `1px solid ${cfg.border}`;
        return badge;
    };

    const renderClaims = (claims) => {
        tableBody.replaceChildren();
        emptyClaims.hidden = claims.length > 0;

        claims.forEach((claim) => {
            const row = document.createElement("tr");

            const cells = [
                { text: claim.reference || "—",       cls: "col-ref"     },
                { text: formatDate(claim.opd_date || claim.created_at), cls: "" },
                { text: claim.claim_type ? capitalize(claim.claim_type) : "—", cls: "" },
                { text: formatAmount(claim.amount_requested), cls: "col-amount" },
                { text: claim.patient_name || "—",    cls: ""            },
            ];

            cells.forEach(({ text, cls }) => {
                const td = document.createElement("td");
                if (cls) td.className = cls;
                td.textContent = text;
                row.append(td);
            });

            // Status badge cell
            const statusTd = document.createElement("td");
            statusTd.append(makeStatusBadge(claim.status));
            row.append(statusTd);

            // Action cell — View → button
            const actionTd = document.createElement("td");
            actionTd.className = "col-action";
            const viewBtn = document.createElement("a");
            viewBtn.href = `claim-details.html?id=${encodeURIComponent(claim.claim_id || "")}`;
            viewBtn.className = "view-link";
            viewBtn.textContent = "View →";
            actionTd.append(viewBtn);
            row.append(actionTd);

            tableBody.append(row);
        });
    };

    const capitalize = (str) =>
        str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "—";

    const loadClaims = async (page = 1) => {
        try {
            const response = await fetch("../../backend/api/employee/employee_claims.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    computer_number: access.computer_number,
                    nic: access.nic,
                    page,
                    limit: LIMIT
                })
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to load claims.");
            }

            const claims     = result.data?.claims || [];
            const pagination = result.data?.pagination || {};
            const total      = pagination.total_claims || 0;
            const totalPages = pagination.total_pages || 1;

            renderClaims(claims);

            // Pagination
            totalText.textContent = `${total} record${total !== 1 ? "s" : ""}`;
            pageLabel.textContent = `Page ${page} of ${totalPages}`;
            prevBtn.disabled = page <= 1;
            nextBtn.disabled = page >= totalPages;
            currentPage = page;
        } catch (err) {
            showMessage(err.message || "Could not load your claims. Please try again.");
            employeeSummary.textContent = "Your claim records could not be loaded.";
        }
    };

    prevBtn.addEventListener("click", () => { if (currentPage > 1) loadClaims(currentPage - 1); });
    nextBtn.addEventListener("click", () => loadClaims(currentPage + 1));

    await loadClaims(1);
});
