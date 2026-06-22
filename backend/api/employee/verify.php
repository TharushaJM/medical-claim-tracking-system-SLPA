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

$computerNumber = trim($input["computer_number"] ?? "");
$nic = trim($input["nic"] ?? "");

if ($computerNumber === "" || $nic === "") {
    sendJsonResponse(false, "Computer number and NIC are required", null, 400);
}

try {
    $sql = "
        SELECT 
            e.e_id,
            e.port,
            e.computer_number,
            e.initials,
            e.surname,
            CONCAT(e.initials, ' ', e.surname) AS employee_name,
            e.payoffice,
            e.service_number,
            e.nic,
            e.dob,
            e.division_code,
            d.division_name,
            e.balance_opd_amount,
            e.balance_specs_amount
        FROM xd_employees e
        LEFT JOIN xd_divisions d
            ON e.division_code = d.div_code
        WHERE e.computer_number = :computer_number
        AND e.nic = :nic
        LIMIT 1
    ";

    $stmt = $conn->prepare($sql);
    $stmt->execute([
        ":computer_number" => $computerNumber,
        ":nic" => $nic
    ]);

    $employee = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$employee) {
        sendJsonResponse(false, "Invalid computer number or NIC", null, 401);
    }

    sendJsonResponse(true, "Employee verified successfully", $employee);

} catch (PDOException $e) {
    sendJsonResponse(false, "Employee verification failed", $e->getMessage(), 500);
}