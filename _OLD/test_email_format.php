<?php
require_once __DIR__ . '/backend/vendor/autoload.php';

use App\Services\EmailService;

// Create EmailService instance
$emailService = new EmailService();

// Test the email formatting with the same content as your template
$testBody = "Hello Mike Pogue,

This is a friendly reminder that you are scheduled to be a squarehead for Rockin' Jokers on Friday, June 13, 2025.

Squarehead duties:
• Arrive at 5:30PM to help set up
• Help with tear down after the dance (approx 9:15PM)
• Assist with greeting dancers and collecting fees
• For a more detailed list of responsibilities, click [here](https://rockinjokers.com/Documents/202503%20Rockin%20Jokers%20Duty%20Square%20Instructions.pdf).

If you cannot make it, please arrange for a substitute and notify the club officers.

Thank you for your service to Rockin' Jokers!

Best regards,
Rockin' Jokers Officers";

// Use reflection to access the protected method
$reflection = new ReflectionClass($emailService);
$method = $reflection->getMethod('getReminderEmailTemplate');
$method->setAccessible(true);

// Generate the HTML
$html = $method->invoke($emailService, $testBody);

// Save to a file so you can open it in a browser
file_put_contents('/Users/mpogue/squarehead/test_email.html', $html);

echo "Test email HTML saved to: /Users/mpogue/squarehead/test_email.html\n";
echo "Open this file in a web browser to see the formatting.\n\n";

// Also show the key part of the HTML
preg_match('/click <a href="[^"]*"[^>]*>here<\/a>/', $html, $matches);
if ($matches) {
    echo "Link HTML: " . $matches[0] . "\n";
} else {
    echo "Link not found - checking for any 'here' links:\n";
    preg_match_all('/here[^<]*<\/a>/', $html, $allMatches);
    print_r($allMatches);
}
?>