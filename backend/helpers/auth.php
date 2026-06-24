<?php

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function require_admin_login() {
    if (!isset($_SESSION["admin_id"])) {
        http_response_code(401);
        header("Content-Type: application/json");

        echo json_encode([
            "success" => false,
            "message" => "Unauthorized. Please login first."
        ]);

        exit;
    }
}

function get_logged_admin_id() {
    return $_SESSION["admin_id"] ?? null;
}
