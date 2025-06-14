<?php
declare(strict_types=1);

use App\Models\Settings;
use App\Services\EmailService;
use App\Middleware\AuthMiddleware;
use App\Helpers\ApiResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

// POST /api/email/test-reminder - Send a test reminder email
$app->post('/api/email/test-reminder', function (Request $request, Response $response) {
    try {
        // Check if user is admin
        $isAdmin = $request->getAttribute('is_admin');
        
        if (!$isAdmin) {
            return ApiResponse::error($response, 'Admin access required to send test emails', 403);
        }
        
        // Get request data
        $data = json_decode($request->getBody()->getContents(), true);
        
        // Validate required fields
        if (empty($data['email'])) {
            return ApiResponse::validationError($response, ['email' => 'Email address is required'], 'Email address is required');
        }
        
        // Get or use default values
        $recipientEmail = $data['email'];
        $memberName = $data['member_name'] ?? 'Test User';
        $danceDate = $data['dance_date'] ?? date('l, F j, Y', strtotime('+7 days'));
        $template = $data['template'] ?? null;
        $subject = $data['subject'] ?? null;
        $clubName = $data['club_name'] ?? null;
        $clubAddress = $data['club_address'] ?? null;
        $fromName = $data['from_name'] ?? null;
        $fromEmail = $data['from_email'] ?? null;
        $logoData = $data['club_logo_data'] ?? null;
        
        // Get settings for fallback values
        $settingsModel = new Settings();
        
        // Instead of creating a custom class, let's modify the EmailService directly
        $emailService = new EmailService();
        
        // Prepare email data
        try {
            // Configure PHPMailer for the test email
            $mailer = $emailService->getMailer();
            $mailer->clearAddresses();
            $mailer->addAddress($recipientEmail);
            
            // If custom from name/email are provided, override the mailer's from
            if ($fromName && $fromEmail) {
                $mailer->setFrom($fromEmail, $fromName);
            }
            
            // Get subject and body templates from parameters or settings
            $subjectTemplate = $subject ?? $settingsModel->get('email_template_subject') ?? 'Squarehead Reminder - {club_name} Dance on {dance_date}';
            $bodyTemplate = $template ?? $settingsModel->get('email_template_body') ?? 'Hello {member_name}, you are scheduled to be a squarehead for {club_name} on {dance_date}.';
            $club = $clubName ?? $settingsModel->get('club_name') ?? 'Square Dance Club';
            $address = $clubAddress ?? $settingsModel->get('club_address') ?? '';
            
            // Replace placeholders in subject
            $emailSubject = str_replace(
                ['{club_name}', '{dance_date}', '{member_name}', '{club_address}'],
                [$club, $danceDate, $memberName, $address],
                $subjectTemplate
            );
            
            // Replace placeholders in body
            $body = str_replace(
                ['{club_name}', '{dance_date}', '{member_name}', '{club_address}'],
                [$club, $danceDate, $memberName, $address],
                $bodyTemplate
            );
            
            $mailer->Subject = "[TEST] " . $emailSubject;
            
            // First escape HTML special characters (but preserve line breaks)
            $htmlBodyContent = htmlspecialchars($body, ENT_NOQUOTES, 'UTF-8');
            $htmlBodyContent = nl2br($htmlBodyContent);
            
            // Process club logo if provided - AFTER escaping HTML but BEFORE converting Markdown
            // This way we can insert the raw HTML for the image
            if ($logoData) {
                // Create the img HTML tag
                $logoHtml = '<img src="data:image/jpeg;base64,' . $logoData . '" alt="' . $club . ' Logo" style="width: 128px; height: 128px; display: block; margin: 10px 0;">';
                
                // Replace the placeholder with the raw HTML
                // We need to replace the escaped version of the placeholder
                $escapedPlaceholder = htmlspecialchars('{club_logo}', ENT_NOQUOTES, 'UTF-8');
                $htmlBodyContent = str_replace($escapedPlaceholder, $logoHtml, $htmlBodyContent);
            }
            
            // Convert markdown links to HTML
            $htmlBodyContent = preg_replace(
                '/\[([^\]]+)\]\(([^)]+)\)/', 
                '<a href="$2" style="color: #EA3323; text-decoration: underline;">$1</a>', 
                $htmlBodyContent
            );
            
            // Create full HTML email with styling
            $clubColor = $settingsModel->get('club_color') ?: '#EA3323';
            $addressLine = $address ? "<br>{$address}" : '';
            
            $emailBody = "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <title>Squarehead Reminder - {$club}</title>
            </head>
            <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; font-size: 16px;'>
                <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
                    <h2 style='color: {$clubColor}; font-size: 24px;'>{$club} Reminder</h2>
                    <div style='font-size: 16px;'>
                        {$htmlBodyContent}
                    </div>
                    <hr style='margin: 30px 0; border: none; border-top: 1px solid #eee;'>
                    <p style='font-size: 14px; color: #666;'>
                        {$club} Management System{$addressLine}<br>
                        This is an automated test email, please do not reply.
                    </p>
                </div>
            </body>
            </html>
            ";
            
            $mailer->Body = $emailBody;
            
            // Create plain text version
            $plainText = $body;
            $plainText = preg_replace('/\[([^\]]+)\]\(([^)]+)\)/', '$1: $2', $plainText);
            $mailer->AltBody = $plainText;
            
            // Send the email
            $success = $mailer->send();
        } catch (Exception $e) {
            error_log("Test email preparation error: " . $e->getMessage());
            throw $e;
        }
        
        if ($success) {
            return ApiResponse::success($response, ['email' => $recipientEmail], 'Test email sent successfully');
        } else {
            return ApiResponse::error($response, 'Failed to send test email. Check SMTP settings.', 500);
        }
        
    } catch (Exception $e) {
        error_log("Test email error: " . $e->getMessage());
        return ApiResponse::error($response, 'Failed to send test email: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// POST /api/email/test-smtp - Test SMTP configuration
$app->post('/api/email/test-smtp', function (Request $request, Response $response) {
    try {
        // Check if user is admin
        $isAdmin = $request->getAttribute('is_admin');
        
        if (!$isAdmin) {
            return ApiResponse::error($response, 'Admin access required to test SMTP configuration', 403);
        }
        
        // Get request data (optional SMTP settings to test)
        $data = json_decode($request->getBody()->getContents(), true);
        
        // Get admin user email for the test
        $adminEmail = $request->getAttribute('user_email');
        
        if (empty($adminEmail)) {
            return ApiResponse::error($response, 'Admin email not found', 400);
        }
        
        // Create EmailService instance
        $emailService = new EmailService();
        
        try {
            // Get the configured PHPMailer instance
            $mailer = $emailService->getMailer();
            
            // If custom SMTP settings are provided in the request, use them temporarily
            if (!empty($data['smtp_host'])) {
                $mailer->Host = $data['smtp_host'];
            }
            if (!empty($data['smtp_port'])) {
                $mailer->Port = (int)$data['smtp_port'];
            }
            if (!empty($data['smtp_username'])) {
                $mailer->Username = $data['smtp_username'];
            }
            if (!empty($data['smtp_password'])) {
                $mailer->Password = $data['smtp_password'];
            }
            
            // Clear any existing recipients and set admin email
            $mailer->clearAddresses();
            $mailer->addAddress($adminEmail);
            
            // Simple test email content
            $mailer->Subject = "[SMTP TEST] Email Configuration Test";
            $mailer->Body = "
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='UTF-8'>
                <title>SMTP Configuration Test</title>
            </head>
            <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
                <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
                    <h2 style='color: #28a745;'>✅ SMTP Configuration Test Successful</h2>
                    <p>This is a test email to verify that your SMTP email configuration is working correctly.</p>
                    <p><strong>Test Details:</strong></p>
                    <ul>
                        <li>SMTP Host: " . htmlspecialchars($mailer->Host) . "</li>
                        <li>SMTP Port: " . htmlspecialchars((string)$mailer->Port) . "</li>
                        <li>SMTP Username: " . htmlspecialchars($mailer->Username) . "</li>
                        <li>Sent at: " . date('Y-m-d H:i:s T') . "</li>
                    </ul>
                    <p>If you received this email, your SMTP configuration is working properly!</p>
                    <hr style='margin: 20px 0; border: none; border-top: 1px solid #eee;'>
                    <p style='font-size: 14px; color: #666;'>
                        This is an automated SMTP test email from your Square Dance Club Management System.
                    </p>
                </div>
            </body>
            </html>
            ";
            
            // Plain text alternative
            $mailer->AltBody = "SMTP Configuration Test Successful\n\n" .
                               "This is a test email to verify that your SMTP email configuration is working correctly.\n\n" .
                               "Test Details:\n" .
                               "- SMTP Host: " . $mailer->Host . "\n" .
                               "- SMTP Port: " . $mailer->Port . "\n" .
                               "- SMTP Username: " . $mailer->Username . "\n" .
                               "- Sent at: " . date('Y-m-d H:i:s T') . "\n\n" .
                               "If you received this email, your SMTP configuration is working properly!";
            
            // Test the SMTP connection first
            if (!$mailer->smtpConnect()) {
                throw new Exception("Failed to connect to SMTP server: " . $mailer->ErrorInfo);
            }
            
            // Send the email
            $success = $mailer->send();
            
            // Close SMTP connection
            $mailer->smtpClose();
            
        } catch (Exception $e) {
            error_log("SMTP test error: " . $e->getMessage());
            
            // Return detailed error information for troubleshooting
            $errorDetails = [
                'error' => $e->getMessage(),
                'smtp_host' => $mailer->Host ?? 'Not set',
                'smtp_port' => $mailer->Port ?? 'Not set',
                'smtp_username' => $mailer->Username ?? 'Not set'
            ];
            
            return ApiResponse::error($response, 'SMTP configuration test failed', 500, $errorDetails);
        }
        
        if ($success) {
            $successData = [
                'test_email_sent_to' => $adminEmail,
                'smtp_host' => $mailer->Host,
                'smtp_port' => $mailer->Port,
                'smtp_username' => $mailer->Username,
                'timestamp' => date('Y-m-d H:i:s T')
            ];
            
            return ApiResponse::success($response, $successData, 'SMTP test email sent successfully! Check your inbox.');
        } else {
            return ApiResponse::error($response, 'Failed to send SMTP test email: ' . $mailer->ErrorInfo, 500);
        }
        
    } catch (Exception $e) {
        error_log("SMTP test endpoint error: " . $e->getMessage());
        return ApiResponse::error($response, 'SMTP test failed: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());