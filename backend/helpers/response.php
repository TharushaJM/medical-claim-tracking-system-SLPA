<?php

/* Allow the frontend when it is previewed with VS Code Live Server. */
$allowedOrigins = ["http://127.0.0.1:5500", "http://localhost:5500"];
$requestOrigin = $_SERVER["HTTP_ORIGIN"] ?? "";
if (in_array($requestOrigin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: " . $requestOrigin);
    header("Access-Control-Allow-Credentials: true");
    header("Vary: Origin");
}
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if (($_SERVER["REQUEST_METHOD"] ?? "GET") === "OPTIONS") {
    http_response_code(204);
    exit;
}

function send_json($success, $message, $data = null, $status_code = 200) {
    http_response_code($status_code);
    header("Content-Type: application/json");

    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ]);

    exit;
}
