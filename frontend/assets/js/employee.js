document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("employeeAccessForm");
    const computerNumberInput = document.getElementById("computerNumber");
    const nicNumberInput = document.getElementById("nicNumber");
    const messageBox = document.getElementById("employeeMessage");
    const newClaimButton = document.getElementById("newClaimBtn");

    if (!form || !computerNumberInput || !nicNumberInput || !messageBox) {
        return;
    }

    const showMessage = (message, type) => {
        messageBox.textContent = message;
        messageBox.className = `slpa-message ${type}`;
    };

    const clearMessage = () => {
        messageBox.textContent = "";
        messageBox.className = "slpa-message";
    };

    [computerNumberInput, nicNumberInput].forEach((input) => {
        input.addEventListener("input", clearMessage);
    });

    async function verifyEmployee(redirectPage) {
        const computerNumber = computerNumberInput.value.trim();
        const nic = nicNumberInput.value.trim();

        if (!computerNumber) {
            showMessage("Computer Number is required.", "error");
            computerNumberInput.focus();
            return;
        }

        if (!nic) {
            showMessage("NIC Number is required.", "error");
            nicNumberInput.focus();
            return;
        }

        showMessage("Verifying your details...", "success");

        try {
            const response = await fetch("../../backend/api/employee/verify.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    computer_number: computerNumber,
                    nic: nic
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                showMessage(result.message || "Unable to verify your details.", "error");
                return;
            }

            sessionStorage.setItem("employeeAccess", JSON.stringify({
                computer_number: computerNumber,
                nic: nic,
                employee: result.data
            }));

            showMessage("Verified successfully. Redirecting...", "success");

            setTimeout(() => {
                window.location.href = redirectPage;
            }, 700);

        } catch (error) {
            console.error(error);
            showMessage(
                "Could not reach the verification service. Please make sure Apache is running and open this page through localhost.",
                "error"
            );
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        await verifyEmployee("claims.html");
    });

    if (newClaimButton) {
        newClaimButton.addEventListener("click", async () => {
            await verifyEmployee("submit-claim.html");
        });
    }
});