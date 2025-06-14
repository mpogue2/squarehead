<?php
declare(strict_types=1);

namespace App\Models;

class Schedule extends BaseModel
{
    protected string $table = 'schedules';
    
    protected array $fillable = [
        'name',
        'schedule_type',
        'start_date',
        'end_date',
        'is_active'
    ];
    
    /**
     * Get current active schedule
     */
    public function getCurrentSchedule(): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM schedules 
            WHERE schedule_type = 'current' AND is_active = 1 
            ORDER BY created_at DESC 
            LIMIT 1
        ");
        $stmt->execute();
        $result = $stmt->fetch();
        
        return $result ?: null;
    }
    
    /**
     * Get next schedule (for editing)
     */
    public function getNextSchedule(): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM schedules 
            WHERE schedule_type = 'next' AND is_active = 1 
            ORDER BY created_at DESC 
            LIMIT 1
        ");
        $stmt->execute();
        $result = $stmt->fetch();
        
        return $result ?: null;
    }
    
    /**
     * Get schedule assignments with user names
     */
    public function getScheduleAssignments(int $scheduleId): array
    {
        $stmt = $this->db->prepare("
            SELECT 
                sa.*,
                u1.first_name as squarehead1_first_name,
                u1.last_name as squarehead1_last_name,
                u2.first_name as squarehead2_first_name,
                u2.last_name as squarehead2_last_name,
                CASE 
                    WHEN u1.first_name IS NOT NULL THEN CONCAT(u1.first_name, ' ', u1.last_name)
                    ELSE NULL 
                END as squarehead1_name,
                CASE 
                    WHEN u2.first_name IS NOT NULL THEN CONCAT(u2.first_name, ' ', u2.last_name)
                    ELSE NULL 
                END as squarehead2_name
            FROM schedule_assignments sa
            LEFT JOIN users u1 ON sa.squarehead1_id = u1.id
            LEFT JOIN users u2 ON sa.squarehead2_id = u2.id
            WHERE sa.schedule_id = ?
            ORDER BY sa.dance_date ASC
        ");
        $stmt->execute([$scheduleId]);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Create schedule assignments for date range
     */
    public function createScheduleAssignments(int $scheduleId, string $startDate, string $endDate, string $dayOfWeek): array
    {
        $assignments = [];
        $current = new \DateTime($startDate);
        $end = new \DateTime($endDate);
        
        // Get target day of week (0 = Sunday, 1 = Monday, etc.)
        $targetDayOfWeek = $this->getDayOfWeekNumber($dayOfWeek);
        
        // Advance to first occurrence of target day
        while ($current->format('w') != $targetDayOfWeek && $current <= $end) {
            $current->add(new \DateInterval('P1D'));
        }
        
        // Create assignments for each week
        while ($current <= $end) {
            $dateStr = $current->format('Y-m-d');
            
            // Determine if this is a fifth week (special club night)
            $clubNightType = $this->getFifthWeekType($current) ? 'FIFTH WED' : 'NORMAL';
            
            // Insert assignment
            $stmt = $this->db->prepare("
                INSERT INTO schedule_assignments (schedule_id, dance_date, club_night_type)
                VALUES (?, ?, ?)
            ");
            $stmt->execute([$scheduleId, $dateStr, $clubNightType]);
            
            $assignmentId = $this->db->lastInsertId();
            $assignments[] = [
                'id' => $assignmentId,
                'schedule_id' => $scheduleId,
                'dance_date' => $dateStr,
                'club_night_type' => $clubNightType,
                'squarehead1_id' => null,
                'squarehead2_id' => null,
                'notes' => null
            ];
            
            // Move to next week
            $current->add(new \DateInterval('P7D'));
        }
        
        return $assignments;
    }
    
    /**
     * Update schedule assignment
     */
    public function updateAssignment(int $assignmentId, array $data): ?array
    {
        $allowedFields = ['squarehead1_id', 'squarehead2_id', 'club_night_type', 'notes'];
        $updateData = [];
        
        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data)) {
                $updateData[$field] = $data[$field];
            }
        }
        
        if (empty($updateData)) {
            return null;
        }
        
        $updateData['updated_at'] = date('Y-m-d H:i:s');
        
        $setParts = [];
        foreach (array_keys($updateData) as $column) {
            $setParts[] = "{$column} = :{$column}";
        }
        
        $sql = "UPDATE schedule_assignments SET " . implode(', ', $setParts) . " WHERE id = :id";
        $updateData['id'] = $assignmentId;
        
        $stmt = $this->db->prepare($sql);
        $success = $stmt->execute($updateData);
        
        if (!$success) {
            return null;
        }
        
        // Return updated assignment with user names
        $stmt = $this->db->prepare("
            SELECT 
                sa.*,
                u1.first_name as squarehead1_first_name,
                u1.last_name as squarehead1_last_name,
                u2.first_name as squarehead2_first_name,
                u2.last_name as squarehead2_last_name,
                CASE 
                    WHEN u1.first_name IS NOT NULL THEN CONCAT(u1.first_name, ' ', u1.last_name)
                    ELSE NULL 
                END as squarehead1_name,
                CASE 
                    WHEN u2.first_name IS NOT NULL THEN CONCAT(u2.first_name, ' ', u2.last_name)
                    ELSE NULL 
                END as squarehead2_name
            FROM schedule_assignments sa
            LEFT JOIN users u1 ON sa.squarehead1_id = u1.id
            LEFT JOIN users u2 ON sa.squarehead2_id = u2.id
            WHERE sa.id = ?
        ");
        $stmt->execute([$assignmentId]);
        
        return $stmt->fetch() ?: null;
    }
    
    /**
     * Get assignment by ID
     */
    public function getAssignmentById(int $assignmentId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT 
                sa.*,
                u1.first_name as squarehead1_first_name,
                u1.last_name as squarehead1_last_name,
                u2.first_name as squarehead2_first_name,
                u2.last_name as squarehead2_last_name,
                CASE 
                    WHEN u1.first_name IS NOT NULL THEN CONCAT(u1.first_name, ' ', u1.last_name)
                    ELSE NULL 
                END as squarehead1_name,
                CASE 
                    WHEN u2.first_name IS NOT NULL THEN CONCAT(u2.first_name, ' ', u2.last_name)
                    ELSE NULL 
                END as squarehead2_name
            FROM schedule_assignments sa
            LEFT JOIN users u1 ON sa.squarehead1_id = u1.id
            LEFT JOIN users u2 ON sa.squarehead2_id = u2.id
            WHERE sa.id = ?
        ");
        $stmt->execute([$assignmentId]);
        
        return $stmt->fetch() ?: null;
    }
    
    /**
     * Delete assignment by ID
     */
    public function deleteAssignment(int $assignmentId): bool
    {
        $stmt = $this->db->prepare("DELETE FROM schedule_assignments WHERE id = ?");
        return $stmt->execute([$assignmentId]);
    }
    
    /**
     * Promote next schedule to current
     */
    public function promoteNextToCurrent(): bool
    {
        $this->db->beginTransaction();
        
        try {
            // Deactivate current schedule
            $stmt = $this->db->prepare("UPDATE schedules SET is_active = 0 WHERE schedule_type = 'current'");
            $stmt->execute();
            
            // Change next schedule to current
            $stmt = $this->db->prepare("UPDATE schedules SET schedule_type = 'current' WHERE schedule_type = 'next' AND is_active = 1");
            $stmt->execute();
            
            $this->db->commit();
            return true;
        } catch (\Exception $e) {
            $this->db->rollBack();
            return false;
        }
    }
    
    /**
     * Convert day name to number
     */
    private function getDayOfWeekNumber(string $dayName): int
    {
        $days = [
            'Sunday' => 0, 'Monday' => 1, 'Tuesday' => 2, 'Wednesday' => 3,
            'Thursday' => 4, 'Friday' => 5, 'Saturday' => 6
        ];
        
        return $days[$dayName] ?? 3; // Default to Wednesday
    }
    
    /**
     * Check if this is a fifth week occurrence
     */
    private function getFifthWeekType(\DateTime $date): bool
    {
        // Check if this is the 5th occurrence of this weekday in the month
        $dayOfWeek = $date->format('w');
        $dayOfMonth = (int)$date->format('j');
        
        // If the day is greater than 28, it could be a fifth occurrence
        return $dayOfMonth > 28;
    }
}
