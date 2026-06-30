document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-change-employee]").forEach((button) => {
        button.addEventListener("click", () => {
            sessionStorage.removeItem("employeeAccess");
            window.location.href = "access.html";
        });
    });
});
