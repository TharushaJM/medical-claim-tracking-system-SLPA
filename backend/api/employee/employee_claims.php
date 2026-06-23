<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require_once "../../config/db.php";
require_once "../../helpers/response.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    sendJsonResponse(false, "Only POST method is allowed", null, 405);
}

// Read JSON input
$input = json_decode(file_get_contents("php://input"), true);

if (!is_array($input)) {
    sendJsonResponse(false, "Invalid JSON body", null, 400);
}

// Get input values
$computerNumber = trim($input["computer_number"] ?? "");
$nic = trim($input["nic"] ?? "");

// Pagination values
$page = isset($input["page"]) ? (int)$input["page"] : 1;
$limit = isset($input["limit"]) ? (int)$input["limit"] : 10;

if ($page < 1) {
    $page = 1;
}

if ($limit < 1) {
    $limit = 10;
}

// Security/performance: do not allow huge data loading
if ($limit > 50) {
    $limit = 50;
}

$offset = ($page - 1) * $limit;

// Required field validation
if ($computerNumber === "" || $nic === "") {
    sendJsonResponse(false, "Computer number and NIC are required", null, 400);
}

try {
    // 1. Verify employee first
    $employeeSql = "
        SELECT e_id, computer_number, nic
        FROM xd_employees
        WHERE computer_number = :computer_number
        AND nic = :nic
        LIMIT 1
    ";

    $employeeStmt = $conn->prepare($employeeSql);
    $employeeStmt->execute([
        ":computer_number" => $computerNumber,
        ":nic" => $nic
    ]);

    $employee = $employeeStmt->fetch(PDO::FETCH_ASSOC);

    if (!$employee) {
        sendJsonResponse(false, "Invalid employee. Please check Computer Number and NIC", null, 401);
    }

    // 2. Count total claims for this employee
    $countSql = "
        SELECT COUNT(*) AS total
        FROM xd_claim_requests
        WHERE emp_computer_number = :computer_number
    ";

    $countStmt = $conn->prepare($countSql);
    $countStmt->execute([
        ":computer_number" => $computerNumber
    ]);

    $totalRow = $countStmt->fetch(PDO::FETCH_ASSOC);
    $totalClaims = (int)$totalRow["total"];
    $totalPages = $totalClaims > 0 ? ceil($totalClaims / $limit) : 1;

    // 3. Get paginated claim list
    $claimsSql = "
        SELECT
            r_id AS claim_id,
            `reference`,
            opd_date,
            claim_type,
            amount_requested,
            patient_name,
            claim_for,
            status,
            is_document_received,
            created_at
        FROM xd_claim_requests
        WHERE emp_computer_number = :computer_number
        ORDER BY created_at DESC, r_id DESC
        LIMIT :limit OFFSET :offset
    ";

    $claimsStmt = $conn->prepare($claimsSql);
    $claimsStmt->bindValue(":computer_number", $computerNumber, PDO::PARAM_STR);
    $claimsStmt->bindValue(":limit", $limit, PDO::PARAM_INT);
    $claimsStmt->bindValue(":offset", $offset, PDO::PARAM_INT);
    $claimsStmt->execute();

    $claims = $claimsStmt->fetchAll(PDO::FETCH_ASSOC);

    sendJsonResponse(true, "Employee claims loaded successfully", [
        "claims" => $claims,
        "pagination" => [
            "page" => $page,
            "limit" => $limit,
            "total_claims" => $totalClaims,
            "total_pages" => $totalPages
        ]
    ], 200);

} catch (Throwable $e) {
    error_log($e->getMessage());

    sendJsonResponse(false, "Failed to load employee claims. Please try again.", null, 500);
}