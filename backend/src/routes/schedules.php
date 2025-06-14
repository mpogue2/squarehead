<?php
declare(strict_types=1);

use App\Models\Schedule;
use App\Models\Settings;
use App\Middleware\AuthMiddleware;
use App\Helpers\ApiResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

// GET /api/schedules/current - Get current schedule with assignments (protected)
$app->get('/api/schedules/current', function (Request $request, Response $response) {
    try {
        $scheduleModel = new Schedule();
        $currentSchedule = $scheduleModel->getCurrentSchedule();
        
        if (!$currentSchedule) {
            return ApiResponse::success($response, [
                'schedule' => null,
                'assignments' => []
            ], 'No current schedule found');
        }
        
        $assignments = $scheduleModel->getScheduleAssignments($currentSchedule['id']);
        
        $responseData = [
            'schedule' => $currentSchedule,
            'assignments' => $assignments,
            'count' => count($assignments)
        ];
        
        return ApiResponse::success($response, $responseData, 'Current schedule retrieved successfully');
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to retrieve current schedule: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// GET /api/schedules/next - Get next schedule with assignments (protected)
$app->get('/api/schedules/next', function (Request $request, Response $response) {
    try {
        $scheduleModel = new Schedule();
        $nextSchedule = $scheduleModel->getNextSchedule();
        
        if (!$nextSchedule) {
            return ApiResponse::success($response, [
                'schedule' => null,
                'assignments' => []
            ], 'No next schedule found');
        }
        
        $assignments = $scheduleModel->getScheduleAssignments($nextSchedule['id']);
        
        $responseData = [
            'schedule' => $nextSchedule,
            'assignments' => $assignments,
            'count' => count($assignments)
        ];
        
        return ApiResponse::success($response, $responseData, 'Next schedule retrieved successfully');
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to retrieve next schedule: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// POST /api/schedules/next - Create new next schedule (admin only)
$app->post('/api/schedules/next', function (Request $request, Response $response) {
    try {
        $isAdmin = $request->getAttribute('is_admin');
        
        if (!$isAdmin) {
            return ApiResponse::error($response, 'Admin access required to create schedules', 403);
        }
        
        $data = json_decode($request->getBody()->getContents(), true);
        
        // Validate required fields
        $requiredFields = ['name', 'start_date', 'end_date'];
        $missingFields = [];
        
        foreach ($requiredFields as $field) {
            if (empty($data[$field])) {
                $missingFields[] = $field;
            }
        }
        
        if (!empty($missingFields)) {
            return ApiResponse::validationError($response, [
                'missing_fields' => $missingFields
            ], 'Required fields are missing');
        }
        
        // Validate dates
        $startDate = $data['start_date'];
        $endDate = $data['end_date'];
        
        if (!DateTime::createFromFormat('Y-m-d', $startDate)) {
            return ApiResponse::validationError($response, [
                'start_date' => 'Invalid date format. Use YYYY-MM-DD'
            ]);
        }
        
        if (!DateTime::createFromFormat('Y-m-d', $endDate)) {
            return ApiResponse::validationError($response, [
                'end_date' => 'Invalid date format. Use YYYY-MM-DD'
            ]);
        }
        
        if ($startDate > $endDate) {
            return ApiResponse::validationError($response, [
                'end_date' => 'End date must be on or after start date'
            ]);
        }
        
        $scheduleModel = new Schedule();
        
        // Deactivate existing next schedule
        $existingNext = $scheduleModel->getNextSchedule();
        if ($existingNext) {
            $scheduleModel->update($existingNext['id'], ['is_active' => 0]);
        }
        
        // Create new schedule
        $scheduleData = [
            'name' => $data['name'],
            'schedule_type' => 'next',
            'start_date' => $startDate,
            'end_date' => $endDate,
            'is_active' => 1
        ];
        
        $newSchedule = $scheduleModel->create($scheduleData);
        
        // Get club day of week from settings
        $settingsModel = new Settings();
        $clubDayOfWeek = $settingsModel->get('club_day_of_week') ?: 'Wednesday';
        
        // Create schedule assignments
        $assignments = $scheduleModel->createScheduleAssignments(
            $newSchedule['id'],
            $startDate,
            $endDate,
            $clubDayOfWeek
        );
        
        $responseData = [
            'schedule' => $newSchedule,
            'assignments' => $assignments,
            'count' => count($assignments)
        ];
        
        return ApiResponse::success($response, $responseData, 'Next schedule created successfully', 201);
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to create schedule: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// POST /api/schedules/next/add-dates - Add dates to existing next schedule (admin only)
$app->post('/api/schedules/next/add-dates', function (Request $request, Response $response) {
    try {
        $isAdmin = $request->getAttribute('is_admin');
        
        if (!$isAdmin) {
            return ApiResponse::error($response, 'Admin access required to modify schedules', 403);
        }
        
        $data = json_decode($request->getBody()->getContents(), true);
        
        // Validate required fields
        $requiredFields = ['start_date', 'end_date'];
        $missingFields = [];
        
        foreach ($requiredFields as $field) {
            if (empty($data[$field])) {
                $missingFields[] = $field;
            }
        }
        
        if (!empty($missingFields)) {
            return ApiResponse::validationError($response, [
                'missing_fields' => $missingFields
            ], 'Required fields are missing');
        }
        
        // Validate dates
        $startDate = $data['start_date'];
        $endDate = $data['end_date'];
        
        if (!DateTime::createFromFormat('Y-m-d', $startDate)) {
            return ApiResponse::validationError($response, [
                'start_date' => 'Invalid date format. Use YYYY-MM-DD'
            ]);
        }
        
        if (!DateTime::createFromFormat('Y-m-d', $endDate)) {
            return ApiResponse::validationError($response, [
                'end_date' => 'Invalid date format. Use YYYY-MM-DD'
            ]);
        }
        
        if ($startDate > $endDate) {
            return ApiResponse::validationError($response, [
                'end_date' => 'End date must be on or after start date'
            ]);
        }
        
        $scheduleModel = new Schedule();
        
        // Get existing next schedule
        $existingNext = $scheduleModel->getNextSchedule();
        if (!$existingNext) {
            return ApiResponse::error($response, 'No next schedule exists to add dates to', 404);
        }
        
        // Get club day of week from settings
        $settingsModel = new Settings();
        $clubDayOfWeek = $settingsModel->get('club_day_of_week') ?: 'Wednesday';
        
        // Add new assignments to existing schedule
        $newAssignments = $scheduleModel->createScheduleAssignments(
            $existingNext['id'],
            $startDate,
            $endDate,
            $clubDayOfWeek
        );
        
        // Get all assignments for the schedule (existing + new)
        $allAssignments = $scheduleModel->getScheduleAssignments($existingNext['id']);
        
        // Update schedule end_date if the new end date is later
        $currentEndDate = new DateTime($existingNext['end_date']);
        $newEndDate = new DateTime($endDate);
        
        if ($newEndDate > $currentEndDate) {
            $scheduleModel->update($existingNext['id'], ['end_date' => $endDate]);
            $existingNext['end_date'] = $endDate;
        }
        
        // Update schedule start_date if the new start date is earlier
        $currentStartDate = new DateTime($existingNext['start_date']);
        $newStartDate = new DateTime($startDate);
        
        if ($newStartDate < $currentStartDate) {
            $scheduleModel->update($existingNext['id'], ['start_date' => $startDate]);
            $existingNext['start_date'] = $startDate;
        }
        
        $responseData = [
            'schedule' => $existingNext,
            'assignments' => $allAssignments,
            'new_assignments' => $newAssignments,
            'count' => count($allAssignments),
            'added_count' => count($newAssignments)
        ];
        
        return ApiResponse::success($response, $responseData, 
            'Added ' . count($newAssignments) . ' new dates to existing schedule', 201);
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to add dates to schedule: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// PUT /api/schedules/assignments/{id} - Update assignment (admin only)
$app->put('/api/schedules/assignments/{id}', function (Request $request, Response $response, array $args) {
    try {
        $isAdmin = $request->getAttribute('is_admin');
        
        if (!$isAdmin) {
            return ApiResponse::error($response, 'Admin access required to update assignments', 403);
        }
        
        $assignmentId = (int)$args['id'];
        $data = json_decode($request->getBody()->getContents(), true);
        
        if (empty($data)) {
            return ApiResponse::validationError($response, [], 'Update data is required');
        }
        
        // Validate squarehead IDs if provided
        if (isset($data['squarehead1_id']) && $data['squarehead1_id'] !== null) {
            $data['squarehead1_id'] = (int)$data['squarehead1_id'];
        }
        
        if (isset($data['squarehead2_id']) && $data['squarehead2_id'] !== null) {
            $data['squarehead2_id'] = (int)$data['squarehead2_id'];
        }
        
        // Validate club night type if provided
        if (isset($data['club_night_type']) && !in_array($data['club_night_type'], ['NORMAL', 'FIFTH WED'])) {
            return ApiResponse::validationError($response, [
                'club_night_type' => 'Club night type must be either NORMAL or FIFTH WED'
            ]);
        }
        
        $scheduleModel = new Schedule();
        $updatedAssignment = $scheduleModel->updateAssignment($assignmentId, $data);
        
        if (!$updatedAssignment) {
            return ApiResponse::notFound($response, 'Assignment not found or no valid fields to update');
        }
        
        return ApiResponse::success($response, $updatedAssignment, 'Assignment updated successfully');
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to update assignment: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// DELETE /api/schedules/assignments/{id} - Delete assignment (admin only)
$app->delete('/api/schedules/assignments/{id}', function (Request $request, Response $response, array $args) {
    try {
        $isAdmin = $request->getAttribute('is_admin');
        
        if (!$isAdmin) {
            return ApiResponse::error($response, 'Admin access required to delete assignments', 403);
        }
        
        $assignmentId = (int)$args['id'];
        
        if ($assignmentId <= 0) {
            return ApiResponse::validationError($response, ['id' => 'Invalid assignment ID']);
        }
        
        $scheduleModel = new Schedule();
        
        // Check if assignment exists
        $assignment = $scheduleModel->getAssignmentById($assignmentId);
        if (!$assignment) {
            return ApiResponse::notFound($response, 'Assignment not found');
        }
        
        // Delete the assignment
        $success = $scheduleModel->deleteAssignment($assignmentId);
        
        if (!$success) {
            return ApiResponse::error($response, 'Failed to delete assignment', 500);
        }
        
        return ApiResponse::success($response, [
            'deleted_assignment_id' => $assignmentId,
            'dance_date' => $assignment['dance_date']
        ], 'Assignment deleted successfully');
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to delete assignment: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// POST /api/schedules/promote - Promote next schedule to current (admin only)
$app->post('/api/schedules/promote', function (Request $request, Response $response) {
    try {
        $isAdmin = $request->getAttribute('is_admin');
        
        if (!$isAdmin) {
            return ApiResponse::error($response, 'Admin access required to promote schedules', 403);
        }
        
        $scheduleModel = new Schedule();
        
        // Check if next schedule exists
        $nextSchedule = $scheduleModel->getNextSchedule();
        if (!$nextSchedule) {
            return ApiResponse::error($response, 'No next schedule found to promote', 404);
        }
        
        $success = $scheduleModel->promoteNextToCurrent();
        
        if (!$success) {
            return ApiResponse::error($response, 'Failed to promote schedule', 500);
        }
        
        // Get the newly promoted current schedule
        $currentSchedule = $scheduleModel->getCurrentSchedule();
        $assignments = $scheduleModel->getScheduleAssignments($currentSchedule['id']);
        
        $responseData = [
            'schedule' => $currentSchedule,
            'assignments' => $assignments,
            'count' => count($assignments)
        ];
        
        return ApiResponse::success($response, $responseData, 'Schedule promoted to current successfully');
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to promote schedule: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());
