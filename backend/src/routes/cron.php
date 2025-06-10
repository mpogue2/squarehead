<?php
declare(strict_types=1);

use App\Models\Settings;
use App\Database;
use App\Services\EmailService;
use App\Helpers\ApiResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

// POST /api/cron/reminders - Send reminder emails for upcoming dances
$app->post('/api/cron/reminders', function (Request $request, Response $response) {
    try {
        // Get settings for reminder configuration
        $settingsModel = new Settings();
        $reminderDays = $settingsModel->get('reminder_days') ?: '14,7,3,1';
        
        // Parse reminder days into array
        $reminderDaysArray = array_map('intval', array_filter(explode(',', $reminderDays)));
        
        if (empty($reminderDaysArray)) {
            return ApiResponse::error($response, 'No reminder days configured', 400);
        }
        
        // Get database connection
        $db = Database::getConnection();
        
        // Find current schedule (active schedule with type 'current')
        $currentScheduleQuery = "
            SELECT id FROM schedules 
            WHERE schedule_type = 'current' 
            AND is_active = 1 
            AND start_date <= date('now') 
            AND end_date >= date('now')
            ORDER BY created_at DESC 
            LIMIT 1
        ";
        
        $stmt = $db->prepare($currentScheduleQuery);
        $stmt->execute();
        $currentSchedule = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$currentSchedule) {
            return ApiResponse::error($response, 'No active current schedule found', 404);
        }
        
        // Get timezone setting
        $timezone = $settingsModel->get('system_timezone') ?: 'UTC';
        
        $scheduleId = $currentSchedule['id'];
        $emailsSent = [];
        $errors = [];
        $emailService = new EmailService();
        
        // For each reminder day, check if there are dances that need reminders
        foreach ($reminderDaysArray as $days) {
            // Calculate the target dance date (X days from today) using the correct timezone
            $today = new DateTime('now', new DateTimeZone($timezone));
            $targetDateTime = clone $today;
            $targetDateTime->add(new DateInterval("P{$days}D"));
            $targetDate = $targetDateTime->format('Y-m-d');
            
            // Find assignments for that date
            $assignmentQuery = "
                SELECT 
                    sa.dance_date,
                    sa.squarehead1_id,
                    sa.squarehead2_id,
                    u1.email as sq1_email,
                    u1.first_name as sq1_first,
                    u1.last_name as sq1_last,
                    u2.email as sq2_email,
                    u2.first_name as sq2_first,
                    u2.last_name as sq2_last
                FROM schedule_assignments sa
                LEFT JOIN users u1 ON sa.squarehead1_id = u1.id
                LEFT JOIN users u2 ON sa.squarehead2_id = u2.id
                WHERE sa.schedule_id = :schedule_id
                AND sa.dance_date = :target_date
                AND (sa.squarehead1_id IS NOT NULL OR sa.squarehead2_id IS NOT NULL)
            ";
            
            $stmt = $db->prepare($assignmentQuery);
            $stmt->bindParam(':schedule_id', $scheduleId, PDO::PARAM_INT);
            $stmt->bindParam(':target_date', $targetDate, PDO::PARAM_STR);
            $stmt->execute();
            
            $assignments = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($assignments as $assignment) {
                $danceDate = $assignment['dance_date'];
                $formattedDate = date('l, F j, Y', strtotime($danceDate));
                
                // Send reminder to squarehead1 if assigned
                if (!empty($assignment['sq1_email'])) {
                    $memberName = trim($assignment['sq1_first'] . ' ' . $assignment['sq1_last']);
                    $email = $assignment['sq1_email'];
                    
                    try {
                        $success = $emailService->sendReminderEmail($email, $memberName, $formattedDate);
                        if ($success) {
                            $emailsSent[] = [
                                'email' => $email,
                                'name' => $memberName,
                                'dance_date' => $formattedDate,
                                'reminder_days' => $days
                            ];
                        } else {
                            $errors[] = "Failed to send reminder to {$memberName} ({$email}) for {$formattedDate}";
                        }
                    } catch (Exception $e) {
                        $errors[] = "Error sending reminder to {$memberName} ({$email}): " . $e->getMessage();
                    }
                }
                
                // Send reminder to squarehead2 if assigned
                if (!empty($assignment['sq2_email'])) {
                    $memberName = trim($assignment['sq2_first'] . ' ' . $assignment['sq2_last']);
                    $email = $assignment['sq2_email'];
                    
                    try {
                        $success = $emailService->sendReminderEmail($email, $memberName, $formattedDate);
                        if ($success) {
                            $emailsSent[] = [
                                'email' => $email,
                                'name' => $memberName,
                                'dance_date' => $formattedDate,
                                'reminder_days' => $days
                            ];
                        } else {
                            $errors[] = "Failed to send reminder to {$memberName} ({$email}) for {$formattedDate}";
                        }
                    } catch (Exception $e) {
                        $errors[] = "Error sending reminder to {$memberName} ({$email}): " . $e->getMessage();
                    }
                }
            }
        }
        
        // Prepare response
        $result = [
            'reminder_days_checked' => $reminderDaysArray,
            'emails_sent' => $emailsSent,
            'total_emails_sent' => count($emailsSent),
            'errors' => $errors,
            'timestamp' => date('Y-m-d H:i:s'),
            'schedule_id' => $scheduleId
        ];
        
        if (!empty($errors)) {
            return ApiResponse::success($response, $result, 'Reminders processed with some errors');
        } else {
            return ApiResponse::success($response, $result, 'Reminders sent successfully');
        }
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to process reminders: ' . $e->getMessage(), 500);
    }
});
