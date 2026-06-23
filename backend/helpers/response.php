<?php

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