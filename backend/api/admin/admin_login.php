<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

require_once "../../config/db.php";
require_once "../../helpers/response.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    sendJsonResponse(false, "Only POST method is allowed", null, 405);
}

$input = json_decode(file_get_contents("php://input"), true);

$username = trim($input["username"] ?? "");
$password = trim($input["password"] ?? "");

if ($username === "" || $password === "") {
    sendJsonResponse(false, "Username and password are required", null, 400);
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
        sendJsonResponse(false, "Invalid username or password", null, 401);
    }

    if ((int)$admin["status"] !== 1) {
        sendJsonResponse(false, "Admin account is inactive", null, 403);
    }

    if (!password_verify($password, $admin["paswd"])) {
        sendJsonResponse(false, "Invalid username or password", null, 401);
    }

    unset($admin["paswd"]);

    sendJsonResponse(true, "Admin login successful", $admin);

} catch (PDOException $e) {
    sendJsonResponse(false, "Admin login failed", $e->getMessage(), 500);
}