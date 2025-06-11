<?php
/**
 * Email Sending Test Script
 * 
 * This script tests the email functionality of the Square Dance Club application.
 * It attempts to send a test email using the configured SMTP settings.
 * 
 * Usage: 
 * php test-email.php [email_address]
 * 
 * If email_address is not provided, it will use the default test address.
 */

// Load autoloader
require __DIR__ . '/vendor/autoload.php';

// Load .env file if it exists
if (file_exists(__DIR__ . '/.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->load();
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

// Get the email address from command line or use default
$testEmail = $argv[1] ?? 'test@example.com';

echo "=================================================================\n";
echo "      Email Sending Test for Square Dance Club Application        \n";
echo "=================================================================\n\n";

echo "Target email: $testEmail\n\n";

// Check if the email format is valid
if (!filter_var($testEmail, FILTER_VALIDATE_EMAIL)) {
    echo "ERROR: The provided email address is not valid.\n";
    exit(1);
}

// Load environment variables or use defaults
$smtpHost = $_ENV['MAIL_HOST'] ?? 'localhost';
$smtpPort = (int)($_ENV['MAIL_PORT'] ?? 587);
$smtpUsername = $_ENV['MAIL_USERNAME'] ?? '';
$smtpPassword = $_ENV['MAIL_PASSWORD'] ?? '';
$fromEmail = $_ENV['MAIL_FROM'] ?? 'noreply@squareheadclub.local';
$fromName = $_ENV['MAIL_FROM_NAME'] ?? 'Square Dance Club';

echo "Using the following SMTP settings:\n";
echo "- Host: $smtpHost\n";
echo "- Port: $smtpPort\n";
echo "- Auth: " . (!empty($smtpUsername) ? 'Yes' : 'No') . "\n";
echo "- Username: " . (!empty($smtpUsername) ? $smtpUsername : 'None') . "\n";
echo "- From: $fromEmail ($fromName)\n\n";

echo "Attempting to send test email...\n\n";

// Create a new PHPMailer instance
$mail = new PHPMailer(true);

try {
    // Enable verbose debug output
    $mail->SMTPDebug = SMTP::DEBUG_SERVER; // Enable verbose debug output
    
    // Configure SMTP
    $mail->isSMTP();
    $mail->Host = $smtpHost;
    $mail->SMTPAuth = !empty($smtpUsername);
    $mail->Username = $smtpUsername;
    $mail->Password = $smtpPassword;
    
    // In test mode, don't require encryption unless explicitly set
    if (empty($_ENV['MAIL_ENCRYPTION'])) {
        $mail->SMTPSecure = '';
        $mail->SMTPAutoTLS = false;
        echo "Notice: Disabling SMTP encryption for testing\n";
    } else {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    }
    
    $mail->Port = $smtpPort;
    $mail->Timeout = 30; // 30 seconds timeout
    
    // Set sender and recipient
    $mail->setFrom($fromEmail, $fromName);
    $mail->addAddress($testEmail);
    
    // Email content
    $mail->isHTML(true);
    $mail->Subject = 'Square Dance Club - Email Test';
    $mail->Body = '
        <html>
        <body>
            <h2>Email Test Successful!</h2>
            <p>This is a test email from the Square Dance Club application.</p>
            <p>If you received this, email sending is working correctly.</p>
            <p>Time sent: ' . date('Y-m-d H:i:s') . '</p>
        </body>
        </html>
    ';
    $mail->AltBody = "Email Test Successful!\n\nThis is a test email from the Square Dance Club application.\nIf you received this, email sending is working correctly.\n\nTime sent: " . date('Y-m-d H:i:s');
    
    // Send the email
    $mail->send();
    
    echo "\n=================================================================\n";
    echo "SUCCESS: Test email sent to $testEmail\n";
    echo "=================================================================\n";
    
} catch (Exception $e) {
    echo "\n=================================================================\n";
    echo "ERROR: Email could not be sent.\n";
    echo "Error details: " . $mail->ErrorInfo . "\n";
    echo "=================================================================\n";
    
    // Provide troubleshooting tips
    echo "\nTroubleshooting tips:\n";
    echo "1. Check that your SMTP server ($smtpHost) is accessible from this machine\n";
    echo "2. Verify the SMTP port ($smtpPort) is correct and not blocked by a firewall\n";
    echo "3. If using authentication, check that your username and password are correct\n";
    echo "4. If using SSL/TLS, ensure your server supports it and the port is appropriate\n";
    echo "5. Check if your SMTP server requires special settings\n\n";
    
    // For common email providers, provide specific guidance
    if (strpos($smtpHost, 'gmail') !== false) {
        echo "For Gmail:\n";
        echo "- Ensure 'Less secure app access' is enabled for your account\n";
        echo "- Or use an App Password if you have 2FA enabled\n";
        echo "- Port should typically be 587 for TLS or 465 for SSL\n\n";
    } elseif (strpos($smtpHost, 'outlook') !== false || strpos($smtpHost, 'office365') !== false) {
        echo "For Outlook/Office365:\n";
        echo "- Use port 587 with TLS encryption\n";
        echo "- Ensure your account has SMTP sending permissions\n\n";
    }
    
    exit(1);
}