<?php

require_once "../../config/db.php";
require_once "../../helpers/response.php";
require_once "../../helpers/auth.php";

require_admin_login();
if ($_SERVER["REQUEST_METHOD"] !== "POST") send_json(false, "Only POST method is allowed", null, 405);
$input = json_decode(file_get_contents("php://input"), true);
$claimId = (int) ($input["claim_id"] ?? 0);
$received = $input["is_document_received"] ?? $input["physical_document_received"] ?? null;
$date = trim($input["document_received_date"] ?? "");
$invoice = trim($input["invoice_number"] ?? $input["physical_file_no"] ?? "");
if ($claimId <= 0 || !in_array((string) $received, ["0", "1", "YES", "NO", "yes", "no"], true)) send_json(false, "Claim ID and document receipt status are required", null, 400);
$received = in_array(strtoupper((string) $received), ["1", "YES"], true) ? 1 : 0;
try {
    $stmt = $conn->prepare("UPDATE xd_claim_requests SET is_document_received = :received, document_received_date = :received_date, invoice_number = :invoice, updated_at = NOW() WHERE r_id = :claim_id");
    $stmt->execute([":received" => $received, ":received_date" => $date !== "" ? $date : null, ":invoice" => $invoice !== "" ? $invoice : null, ":claim_id" => $claimId]);
    if ($stmt->rowCount() === 0) { $exists = $conn->prepare("SELECT 1 FROM xd_claim_requests WHERE r_id = ?"); $exists->execute([$claimId]); if (!$exists->fetchColumn()) send_json(false, "Claim not found", null, 404); }
    send_json(true, "Document tracking updated successfully");
} catch (PDOException $e) { send_json(false, "Failed to update document tracking", null, 500); }
