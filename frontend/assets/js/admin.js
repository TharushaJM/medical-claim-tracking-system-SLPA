document.addEventListener("DOMContentLoaded", function () {
    const adminLoginForm = document.getElementById("adminLoginForm");
    const loginError = document.getElementById("loginError");
    const logoutBtn = document.getElementById("logoutBtn");

    const ADMIN_LOGIN_API =
        "http://localhost/medical-claim-tracking-system-SLPA/backend/api/admin/admin_login.php";

    if (adminLoginForm) {
        adminLoginForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const username = document.getElementById("adminUsername").value.trim();
            const password = document.getElementById("adminPassword").value.trim();

            hideError();

            if (username === "" || password === "") {
                showError("Please enter username and password.");
                return;
            }

            try {
                const response = await fetch(ADMIN_LOGIN_API, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        username: username,
                        password: password
                    })
                });

                const result = await response.json();

                if (!result.success) {
                    showError(result.message);
                    return;
                }

                localStorage.setItem("adminLoggedIn", "true");
                localStorage.setItem("adminUser", JSON.stringify(result.data));

                window.location.href = "dashboard.html";

            } catch (error) {
                console.error(error);
                showError("Server error. Please check backend connection.");
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            localStorage.removeItem("adminLoggedIn");
            localStorage.removeItem("adminUser");
            window.location.href = "login.html";
        });
    }

    function showError(message) {
        if (loginError) {
            loginError.textContent = message;
            loginError.style.display = "block";
        } else {
            alert(message);
        }
    }

    function hideError() {
        if (loginError) {
            loginError.textContent = "";
            loginError.style.display = "none";
        }
    }
});