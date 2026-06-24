<?php

require_once "../../config/db.php";
require_once "../../helpers/response.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    send_json(false, "Only POST method is allowed", null, 405);
}

$input = json_decode(file_get_contents("php://input"), true);

$username = trim($input["username"] ?? "");
$password = trim($input["password"] ?? "");

if ($username === "" || $password === "") {
    send_json(false, "Username and password are required", null, 400);
}

try {
    $sql = "
        SELECT 
            u_id,
            fullname,
            username,
            paswd,
            status
        FROM xsu_system_users
        WHERE username = :username
        LIMIT 1
    ";

    $stmt = $conn->prepare($sql);
    $stmt->execute([
        ":username" => $username
    ]);

    $admin = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$admin) {
        send_json(false, "Invalid username or password", null, 401);
    }

    if ((int)$admin["status"] !== 1) {
        send_json(false, "Admin account is inactive", null, 403);
    }

    if (!password_verify($password, $admin["paswd"])) {
        send_json(false, "Invalid username or password", null, 401);
    }

    session_start();
    session_regenerate_id(true);
    $_SESSION["admin_id"] = (int) $admin["u_id"];
    $_SESSION["admin_username"] = $admin["username"];
    $_SESSION["admin_fullname"] = $admin["fullname"];

    unset($admin["paswd"], $admin["status"]);

    send_json(true, "Admin login successful", $admin);

} catch (PDOException $e) {
    send_json(false, "Admin login failed", null, 500);
}
