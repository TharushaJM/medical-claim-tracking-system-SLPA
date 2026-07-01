<?php

require_once "../../config/db.php";
require_once "../../helpers/response.php";
require_once "../../helpers/auth.php";

require_admin_login();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    send_json(false, "Only POST method is allowed", null, 405);
}

$input = json_decode(file_get_contents("php://input"), true);

if (!is_array($input)) {
    send_json(false, "A JSON request body is required", null, 400);
}

$currentPassword = (string)($input["current_password"] ?? "");
$newPassword = (string)($input["new_password"] ?? "");
$confirmPassword = (string)($input["confirm_password"] ?? "");
$adminId = (int)get_logged_admin_id();

if ($currentPassword === "" || $newPassword === "" || $confirmPassword === "") {
    send_json(false, "Current password, new password, and confirm password are required", null, 400);
}

if (strlen($newPassword) < 8) {
    send_json(false, "New password must be at least 8 characters long", null, 400);
}

if ($newPassword !== $confirmPassword) {
    send_json(false, "New password and confirm password do not match", null, 400);
}

if ($currentPassword === $newPassword) {
    send_json(false, "New password must be different from the current password", null, 400);
}

try {
    $stmt = $conn->prepare("
        SELECT u_id, paswd, status
        FROM xsu_system_users
        WHERE u_id = :admin_id
        LIMIT 1
    ");
    $stmt->execute([":admin_id" => $adminId]);
    $admin = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$admin) {
        send_json(false, "Admin account was not found", null, 404);
    }

    if ((int)$admin["status"] !== 1) {
        send_json(false, "Admin account is inactive", null, 403);
    }

    if (!password_verify($currentPassword, $admin["paswd"])) {
        send_json(false, "Current password is incorrect", null, 401);
    }

    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);

    $update = $conn->prepare("
        UPDATE xsu_system_users
        SET paswd = :new_password
        WHERE u_id = :admin_id
    ");
    $update->execute([
        ":new_password" => $newHash,
        ":admin_id" => $adminId
    ]);

    session_regenerate_id(true);

    send_json(true, "Password changed successfully");

} catch (PDOException $e) {
    send_json(false, "Failed to change password", null, 500);
}
