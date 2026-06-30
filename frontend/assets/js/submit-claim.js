

document.addEventListener("DOMContentLoaded", () => {

    /* ── Auth guard: must have a valid session ─────────────────── */
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

    /* ── DOM references ────────────────────────────────────────── */
    const form          = document.getElementById("submitClaimForm");
    const messageBox    = document.getElementById("scMessage");
    const submitBtn     = document.getElementById("scSubmitBtn");
    const clearBtn      = document.getElementById("scClearBtn");

    // Read-only identity fields
    const refInput      = document.getElementById("scReference");
    const compInput     = document.getElementById("scComputerNumber");
    const nicInput      = document.getElementById("scNic");
    const nameInput     = document.getElementById("scEmployeeName");
    const divInput      = document.getElementById("scDivision");
    const telInput      = document.getElementById("scTelephone");

    // Editable claim fields
    const opdDateInput  = document.getElementById("scOpdDate");
    const amountInput   = document.getElementById("scAmount");
    const claimTypeSelect = document.getElementById("scClaimType");
    const claimForSelect  = document.getElementById("scClaimFor");
    const patientInput  = document.getElementById("scPatientName");

    /* ── Pre-fill session data (editable — employee can correct) ─── */
    compInput.value = access.computer_number || "";
    nicInput.value  = access.nic || "";

    // Employee data returned from verify.php
    const emp = access.employee || {};
    nameInput.value = emp.employee_name  || "";
    divInput.value  = emp.division_name  || "";
    telInput.value  = emp.telephone      || "";

    // Auto-generate Reference Number (system assigned).
    function generateReference() {
        const year   = new Date().getFullYear();
        const seq    = String(Math.floor(10000 + Math.random() * 90000));
        return `MC-${year}-${seq}`;
    }
    refInput.value = generateReference();

    // ── Helpers ───────────────────────────────────────────────── */
    function showMessage(text, type = "error") {
        messageBox.textContent = text;
        messageBox.className   = `claims-message ${type}`;
        messageBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function clearMessage() {
        messageBox.textContent = "";
        messageBox.className   = "claims-message";
    }

    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        submitBtn.textContent = isLoading ? "Submitting…" : "";
        if (!isLoading) {
            submitBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Submit Claim Request`;
        }
    }

    // Clear only claim-entry fields; verified employee details stay visible.
    clearBtn.addEventListener("click", () => {
        opdDateInput.value    = "";
        amountInput.value     = "";
        claimTypeSelect.value = "opd";
        claimForSelect.value  = "MYSELF";
        patientInput.value    = "";
        refInput.value        = generateReference(); // fresh reference
        clearMessage();
        opdDateInput.focus();
    });

    // Auto-fill patient name when "Myself" is chosen /
    claimForSelect.addEventListener("change", () => {
        if (claimForSelect.value === "MYSELF") {
            patientInput.value = nameInput.value || "";
        } else {
            patientInput.value = "";
        }
    });

    // Form submission 
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearMessage();

        /* Client-side validation */
        const reference      = refInput.value.trim();
        const computerNumber = compInput.value.trim();
        const nic            = nicInput.value.trim();
        const opdDate        = opdDateInput.value.trim();
        const amountRaw      = amountInput.value.trim();
        const claimType      = claimTypeSelect.value;
        const claimFor       = claimForSelect.value;
        const patientName    = patientInput.value.trim();

        if (!computerNumber) {
            showMessage("Computer Number is required.");
            compInput.focus();
            return;
        }

        if (!nic) {
            showMessage("NIC is required.");
            nicInput.focus();
            return;
        }

        if (!opdDate) {
            showMessage("OPD Date is required.");
            opdDateInput.focus();
            return;
        }

        // Prevent future dates
        const today   = new Date();
        const selected = new Date(opdDate);
        today.setHours(0, 0, 0, 0);
        if (selected > today) {
            showMessage("OPD Date cannot be a future date.");
            opdDateInput.focus();
            return;
        }

        if (!amountRaw || isNaN(Number(amountRaw)) || Number(amountRaw) <= 0) {
            showMessage("Please enter a valid amount greater than zero.");
            amountInput.focus();
            return;
        }

        if (!patientName) {
            showMessage("Patient Name is required.");
            patientInput.focus();
            return;
        }

        /* Build payload — exactly matches submit_claim.php expected fields */
        const payload = {
            reference,
            computer_number : computerNumber,
            nic,
            opd_date        : opdDate,               // YYYY-MM-DD
            amount_requested: parseFloat(amountRaw),
            claim_type      : claimType,             // 'opd' | 'specs'
            claim_for       : claimFor,              // 'MYSELF' | 'SPOUSE' | 'CHILD' | 'MOTHER' | 'FATHER'
            patient_name    : patientName
        };

        setLoading(true);

        try {
            const response = await fetch("../../backend/api/employee/submit_claim.php", {
                method : "POST",
                headers: { "Content-Type": "application/json" },
                body   : JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                showMessage(result.message || "Claim submission failed. Please try again.");
                // If duplicate reference, auto-regenerate a new one silently
                if (response.status === 409) {
                    refInput.value = generateReference();
                }
                return;
            }

            /* ── Success ──────────────────────────────────────────── */
            const savedRef = result.data?.reference || reference;
            showMessage(
                `✓ Claim submitted successfully! Reference: ${savedRef}. Please hand-deliver your physical form to the Wellness Center.`,
                "success"
            );

            // Disable the form fields after success
            form.querySelectorAll("input:not([readonly]), select, button").forEach(el => {
                el.disabled = true;
            });

            // Redirect to claims list after a short delay
            setTimeout(() => {
                window.location.href = "claims.html";
            }, 3500);

        } catch (err) {
            console.error(err);
            showMessage(
                "Could not reach the server. Please ensure Apache is running and this page is accessed via localhost."
            );
        } finally {
            setLoading(false);
        }
    });

    //  Clear message on any input change 
    [compInput, nicInput, nameInput, divInput, telInput,
     opdDateInput, amountInput, claimTypeSelect, claimForSelect, patientInput].forEach(el => {
        el.addEventListener("input", clearMessage);
        el.addEventListener("change", clearMessage);
    });

});
