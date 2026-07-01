document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("employeeAccessForm");
  const computerNumberInput = document.getElementById("computerNumber");
  const nicNumberInput = document.getElementById("nicNumber");
  const messageBox = document.getElementById("employeeMessage");
  const newClaimButton = document.getElementById("newClaimBtn");
  const protectedNavLinks = document.querySelectorAll(
    "[data-employee-redirect]",
  );

  if (!form || !computerNumberInput || !nicNumberInput || !messageBox) {
    return;
  }

  let messageTimer;

  const showMessage = (message, type) => {
    clearTimeout(messageTimer);
    messageBox.textContent = message;
    messageBox.className = `slpa-message slpa-toast ${type}`;

    messageTimer = setTimeout(() => {
      clearMessage();
    }, 4000);
  };

  const clearMessage = () => {
    clearTimeout(messageTimer);
    messageBox.textContent = "";
    messageBox.className = "slpa-message";
  };

  [computerNumberInput, nicNumberInput].forEach((input) => {
    input.addEventListener("input", clearMessage);
  });

  async function verifyEmployee(redirectPage, actionType = "claims") {
    const computerNumber = computerNumberInput.value.trim();
    const nic = nicNumberInput.value.trim();

    const actionMessages = {
      claims: {
        both: "Please enter your Computer Number and NIC Number before viewing your claims.",
        computer:
          "Please enter your Computer Number before viewing your claims.",
        nic: "Please enter your NIC Number before viewing your claims.",
      },
      newClaim: {
        both: "Please enter your Computer Number and NIC Number before submitting a new claim.",
        computer:
          "Please enter your Computer Number before submitting a new claim.",
        nic: "Please enter your NIC Number before submitting a new claim.",
      },
    };

    const messages = actionMessages[actionType] || actionMessages.claims;

    if (!computerNumber && !nic) {
      showMessage(messages.both, "error");
      computerNumberInput.focus();
      return;
    }

    if (!computerNumber) {
      showMessage(messages.computer, "error");
      computerNumberInput.focus();
      return;
    }

    if (!nic) {
      showMessage(messages.nic, "error");
      nicNumberInput.focus();
      return;
    }

    showMessage("Verifying your details...", "success");

    try {
      const response = await fetch("../../backend/api/employee/verify.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          computer_number: computerNumber,
          nic: nic,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        showMessage(
          result.message || "Unable to verify your details.",
          "error",
        );
        return;
      }

      sessionStorage.setItem(
        "employeeAccess",
        JSON.stringify({
          computer_number: computerNumber,
          nic: nic,
          employee: result.data,
        }),
      );

      showMessage("Verified successfully. Redirecting...", "success");

      setTimeout(() => {
        window.location.href = redirectPage;
      }, 700);
    } catch (error) {
      console.error(error);
      showMessage(
        "Could not reach the verification service. Please make sure Apache is running and open this page through localhost.",
        "error",
      );
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await verifyEmployee("claims.html", "claims");
  });

  if (newClaimButton) {
    newClaimButton.addEventListener("click", async () => {
      await verifyEmployee("submit-claim.html", "newClaim");
    });
  }

  protectedNavLinks.forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      const redirectPage =
        link.dataset.employeeRedirect || link.getAttribute("href");
      const actionType = redirectPage.includes("submit-claim")
        ? "newClaim"
        : "claims";

      await verifyEmployee(redirectPage, actionType);
    });
  });
});
