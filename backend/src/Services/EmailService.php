<?php
declare(strict_types=1);

namespace App\Services;

use App\Models\Settings;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

class EmailService
{
    private PHPMailer $mailer;
    private Settings $settingsModel;
    
    public function __construct()
    {
        $this->settingsModel = new Settings();
        $this->mailer = new PHPMailer(true);
        $this->configureMailer();
    }
    
    /**
     * Configure PHPMailer settings using database settings or fallback to ENV
     */
    private function configureMailer(): void
    {
        try {
            // Get SMTP settings from database, fallback to ENV
            $smtpHost = $this->settingsModel->get('smtp_host') ?: ($_ENV['MAIL_HOST'] ?? 'localhost');
            $smtpPort = $this->settingsModel->get('smtp_port') ?: ($_ENV['MAIL_PORT'] ?? 587);
            $smtpUsername = $this->settingsModel->get('smtp_username') ?: ($_ENV['MAIL_USERNAME'] ?? '');
            $smtpPassword = $this->settingsModel->get('smtp_password') ?: ($_ENV['MAIL_PASSWORD'] ?? '');
            
            // Get email settings from database, fallback to ENV
            $fromEmail = $this->settingsModel->get('email_from_address') ?: ($_ENV['MAIL_FROM'] ?? 'noreply@squareheadclub.local');
            $fromName = $this->settingsModel->get('email_from_name') ?: ($_ENV['MAIL_FROM_NAME'] ?? 'Square Dance Club');
            
            // Check for development environment
            $isDevelopment = (getenv('APP_ENV') === 'development' || !getenv('APP_ENV'));
            
            // Log the settings we're using
            error_log("Email configuration using: Host={$smtpHost}, Port={$smtpPort}, Auth=" . (!empty($smtpUsername) ? 'Yes' : 'No'));
            
            // Server settings
            $this->mailer->isSMTP();
            $this->mailer->Host       = $smtpHost;
            $this->mailer->SMTPAuth   = !empty($smtpUsername);
            $this->mailer->Username   = $smtpUsername;
            $this->mailer->Password   = $smtpPassword;
            
            // In development mode, don't require encryption unless explicitly set
            if ($isDevelopment && empty($_ENV['MAIL_ENCRYPTION'])) {
                $this->mailer->SMTPSecure = '';
                $this->mailer->SMTPAutoTLS = false;
                error_log("Development mode: Disabling SMTP encryption for easier testing");
            } else {
                $this->mailer->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            }
            
            $this->mailer->Port = (int)$smtpPort;
            
            // Default sender
            $this->mailer->setFrom($fromEmail, $fromName);
            
            // Content type
            $this->mailer->isHTML(true);
            $this->mailer->CharSet = 'UTF-8';
            
            // For development mode, set a longer timeout
            if ($isDevelopment) {
                $this->mailer->Timeout = 30; // 30 seconds timeout instead of default 10
            }
            
        } catch (Exception $e) {
            error_log("Email configuration error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
        }
    }
    
    /**
     * Send login link email
     */
    public function sendLoginLink(string $email, string $token): bool
    {
        // Log for debugging regardless of whether email sends
        $loginUrl = "http://localhost:5181/login?token=" . urlencode($token);
        $logMessage = "LOGIN LINK for {$email}: {$loginUrl}";
        error_log($logMessage);
        
        // Ensure logs directory exists
        if (!is_dir(__DIR__ . '/../../logs')) {
            mkdir(__DIR__ . '/../../logs', 0777, true);
        }
        
        // Write to log files (still do this for backup)
        file_put_contents(__DIR__ . '/../../logs/login_links.log', date('[Y-m-d H:i:s] ') . $logMessage . PHP_EOL, FILE_APPEND);
        
        try {
            // Configure mailer for this specific email
            $this->mailer->clearAddresses();
            $this->mailer->addAddress($email);
            
            // Get club settings for email
            $clubName = $this->settingsModel->get('club_name') ?: 'Square Dance Club';
            
            // Set subject and content
            $this->mailer->Subject = "{$clubName} Login Link";
            $this->mailer->Body = $this->getLoginEmailTemplate($loginUrl);
            $this->mailer->AltBody = "Click this link to log in: " . $loginUrl;
            
            // Log detailed email settings for debugging
            error_log("Attempting to send real email with the following settings:");
            error_log("SMTP Host: " . $this->mailer->Host);
            error_log("SMTP Port: " . $this->mailer->Port);
            error_log("SMTP Auth: " . ($this->mailer->SMTPAuth ? 'Yes' : 'No'));
            error_log("From: " . $this->mailer->From);
            error_log("To: " . $email);
            
            // For development, use more verbose debugging
            if (getenv('APP_ENV') === 'development' || !getenv('APP_ENV')) {
                $this->mailer->SMTPDebug = 2; // 2 = client and server messages
                $this->mailer->Debugoutput = function($str, $level) {
                    error_log("SMTP Debug: $str");
                };
            }
            
            // Send the email
            $result = $this->mailer->send();
            error_log("Email send result: " . ($result ? 'Success' : 'Failed'));
            
            // Reset debug level
            $this->mailer->SMTPDebug = 0;
            
            return $result;
            
        } catch (Exception $e) {
            error_log("Email sending error: " . $e->getMessage());
            
            // Log the full exception trace for better debugging
            error_log("Stack trace: " . $e->getTraceAsString());
            
            return false;
        }
    }

    /**
     * Send reminder email
     */
    public function sendReminderEmail(string $email, string $memberName, string $danceDate): bool
    {
        try {
            $this->mailer->clearAddresses();
            $this->mailer->addAddress($email);
            
            // Get subject and body templates from settings
            $subjectTemplate = $this->settingsModel->get('email_template_subject') ?: 'Squarehead Reminder - {club_name} Dance on {dance_date}';
            $bodyTemplate = $this->settingsModel->get('email_template_body') ?: 'Hello {member_name}, you are scheduled to be a squarehead for {club_name} on {dance_date}.';
            $clubName = $this->settingsModel->get('club_name') ?: 'Square Dance Club';
            
            // Replace placeholders in subject
            $subject = str_replace(
                ['{club_name}', '{dance_date}', '{member_name}'],
                [$clubName, $danceDate, $memberName],
                $subjectTemplate
            );
            
            // Replace placeholders in body and convert Markdown links
            $body = str_replace(
                ['{club_name}', '{dance_date}', '{member_name}'],
                [$clubName, $danceDate, $memberName],
                $bodyTemplate
            );
            
            $this->mailer->Subject = $subject;
            $this->mailer->Body = $this->getReminderEmailTemplate($body);
            $this->mailer->AltBody = $this->convertMarkdownLinksToText($body);
            
            return $this->mailer->send();
            
        } catch (Exception $e) {
            error_log("Email sending error: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Convert Markdown-style links to HTML links
     * Format: [Link text Here](https://link-url-here.org)
     * Works with already HTML-escaped text
     */
    protected function convertMarkdownLinksToHtml(string $text): string
    {
        // Pattern to match [text](url) format in HTML-escaped text
        $pattern = '/\[([^\]]+)\]\(([^)]+)\)/';
        
        return preg_replace($pattern, '<a href="$2" style="color: #EA3323; text-decoration: underline;">$1</a>', $text);
    }

    /**
     * Convert Markdown-style links to plain text for alt body
     * Format: [Link text Here](https://link-url-here.org) becomes "Link text Here: https://link-url-here.org"
     */
    protected function convertMarkdownLinksToText(string $text): string
    {
        // Pattern to match [text](url) format
        $pattern = '/\[([^\]]+)\]\(([^)]+)\)/';
        
        return preg_replace($pattern, '$1: $2', $text);
    }
    
    /**
     * Get login email HTML template using dynamic settings
     */
    private function getLoginEmailTemplate(string $loginUrl): string
    {
        // Get club settings for email template
        $clubName = $this->settingsModel->get('club_name') ?: 'Square Dance Club';
        $clubColor = $this->settingsModel->get('club_color') ?: '#EA3323';
        $clubAddress = $this->settingsModel->get('club_address') ?: '';
        
        $addressLine = $clubAddress ? "<br>{$clubAddress}" : '';
        
        return "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <title>Login Link - {$clubName}</title>
        </head>
        <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; font-size: 16px;'>
            <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
                <h2 style='color: {$clubColor}; font-size: 24px;'>{$clubName} Login</h2>
                <p style='font-size: 16px;'>You requested a login link for the {$clubName} Management System.</p>
                <p style='font-size: 16px;'>Click the button below to log in:</p>
                <p style='text-align: center; margin: 30px 0;'>
                    <a href='{$loginUrl}' 
                       style='background-color: {$clubColor}; color: white; padding: 15px 30px; 
                              text-decoration: none; border-radius: 4px; display: inline-block;
                              font-size: 18px; font-weight: bold;'>
                        Log In to {$clubName}
                    </a>
                </p>
                <p style='font-size: 14px;'><small>This link will expire in 1 hour for security purposes.</small></p>
                <p style='font-size: 14px;'><small>If you didn't request this login link, you can safely ignore this email.</small></p>
                <hr style='margin: 30px 0; border: none; border-top: 1px solid #eee;'>
                <p style='font-size: 14px; color: #666;'>
                    {$clubName} Management System{$addressLine}<br>
                    This is an automated message, please do not reply.
                </p>
            </div>
        </body>
        </html>
        ";
    }

    /**
     * Get reminder email HTML template using dynamic settings with Markdown link support
     */
    private function getReminderEmailTemplate(string $bodyContent): string
    {
        // Get club settings for email template
        $clubName = $this->settingsModel->get('club_name') ?: 'Square Dance Club';
        $clubColor = $this->settingsModel->get('club_color') ?: '#EA3323';
        $clubAddress = $this->settingsModel->get('club_address') ?: '';
        
        $addressLine = $clubAddress ? "<br>{$clubAddress}" : '';
        
        // First escape HTML special characters (but preserve line breaks)
        $htmlBodyContent = htmlspecialchars($bodyContent, ENT_NOQUOTES, 'UTF-8');
        
        // Convert line breaks to HTML
        $htmlBodyContent = nl2br($htmlBodyContent);
        
        // Now convert Markdown links to HTML (after escaping, so we control the HTML)
        $htmlBodyContent = $this->convertMarkdownLinksToHtml($htmlBodyContent);
        
        return "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='UTF-8'>
            <title>Squarehead Reminder - {$clubName}</title>
        </head>
        <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; font-size: 16px;'>
            <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
                <h2 style='color: {$clubColor}; font-size: 24px;'>{$clubName} Reminder</h2>
                <div style='font-size: 16px;'>
                    {$htmlBodyContent}
                </div>
                <hr style='margin: 30px 0; border: none; border-top: 1px solid #eee;'>
                <p style='font-size: 14px; color: #666;'>
                    {$clubName} Management System{$addressLine}<br>
                    This is an automated reminder, please do not reply.
                </p>
            </div>
        </body>
        </html>
        ";
    }
}