<?php


$allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500"
];

$requestOrigin = $_SERVER["HTTP_ORIGIN"] ?? "";

if (in_array($requestOrigin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: " . $requestOrigin);
    header("Access-Control-Allow-Credentials: true");
    header("Vary: Origin");
}

header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");

// Handle browser preflight request
if (($_SERVER["REQUEST_METHOD"] ?? "GET") === "OPTIONS") {
    http_response_code(204);
    exit;
}

// Main JSON response function used by employee APIs
if (!function_exists("sendJsonResponse")) {
    function sendJsonResponse($success, $message, $data = null, $status_code = 200)
    {
        http_response_code($status_code);

        echo json_encode([
            "success" => $success,
            "message" => $message,
            "data" => $data
        ], JSON_UNESCAPED_UNICODE);

        exit;
    }
}

// Compatibility function used by admin APIs

if (!function_exists("send_json")) {
    function send_json($success, $message, $data = null, $status_code = 200)
    {
        sendJsonResponse($success, $message, $data, $status_code);
    }
}

