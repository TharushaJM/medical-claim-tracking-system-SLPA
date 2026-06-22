<?php

require_once "../config/db.php";

header("Content-Type: application/json");

echo json_encode([
    "success" => true,
    "message" => "Database connected successfully"
]);