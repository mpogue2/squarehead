<?php
declare(strict_types=1);

namespace App\Services;

/**
 * A service for tracking progress of long-running operations across HTTP requests
 */
class ProgressTracker
{
    private $progressDir;
    private $progressFile;
    private $operation;

    /**
     * Create a new ProgressTracker
     * 
     * @param string $operation The operation identifier (e.g., 'geocoding')
     */
    public function __construct(string $operation)
    {
        $this->operation = $operation;
        $this->progressDir = dirname(dirname(__DIR__)) . '/logs';
        $this->progressFile = $this->progressDir . '/' . $operation . '_progress.json';
        
        // Ensure the directory exists and is writable
        if (!is_dir($this->progressDir)) {
            mkdir($this->progressDir, 0755, true);
        }
        
        if (!is_writable($this->progressDir)) {
            throw new \RuntimeException("Directory {$this->progressDir} is not writable");
        }
    }

    /**
     * Initialize progress tracking for an operation
     * 
     * @param int $total Total number of items to process
     * @return bool Success status
     */
    public function initialize(int $total): bool
    {
        $data = [
            'operation' => $this->operation,
            'total' => $total,
            'completed' => 0,
            'timestamp' => time(),
            'status' => 'in_progress'
        ];
        
        error_log("Initializing progress tracker for {$this->operation}: " . json_encode($data));
        
        return file_put_contents($this->progressFile, json_encode($data)) !== false;
    }

    /**
     * Increment the completion count
     * 
     * @param int $increment Amount to increment the completion count by
     * @return bool Success status
     */
    public function increment(int $increment = 1): bool
    {
        $data = $this->getProgress();
        
        if (!$data) {
            error_log("Failed to increment progress: no progress data found");
            return false;
        }
        
        $data['completed'] += $increment;
        $data['timestamp'] = time();
        
        if ($data['completed'] >= $data['total']) {
            $data['status'] = 'completed';
        }
        
        error_log("Incrementing progress for {$this->operation}: {$data['completed']} of {$data['total']}");
        
        return file_put_contents($this->progressFile, json_encode($data)) !== false;
    }

    /**
     * Update the progress with specific values
     * 
     * @param int $completed Number of completed items
     * @param int|null $total Optional new total
     * @param string|null $status Optional new status
     * @return bool Success status
     */
    public function update(int $completed, ?int $total = null, ?string $status = null): bool
    {
        $data = $this->getProgress();
        
        if (!$data) {
            // If no progress data exists, create a new record
            $data = [
                'operation' => $this->operation,
                'total' => $total ?? 0,
                'completed' => $completed,
                'timestamp' => time(),
                'status' => $status ?? 'in_progress'
            ];
        } else {
            // Update existing data
            $data['completed'] = $completed;
            if ($total !== null) {
                $data['total'] = $total;
            }
            if ($status !== null) {
                $data['status'] = $status;
            }
            $data['timestamp'] = time();
        }
        
        error_log("Updating progress for {$this->operation}: {$data['completed']} of {$data['total']} ({$data['status']})");
        
        return file_put_contents($this->progressFile, json_encode($data)) !== false;
    }

    /**
     * Get the current progress data
     * 
     * @return array|null Progress data or null if not found
     */
    public function getProgress(): ?array
    {
        if (!file_exists($this->progressFile)) {
            return null;
        }
        
        $data = json_decode(file_get_contents($this->progressFile), true);
        
        if (!$data) {
            return null;
        }
        
        // Check if the progress is stale (older than 5 minutes)
        $now = time();
        $isStale = ($now - ($data['timestamp'] ?? 0)) > 300;
        
        if ($isStale && $data['status'] !== 'completed') {
            $data['status'] = 'stale';
        }
        
        return $data;
    }

    /**
     * Reset the progress tracking
     * 
     * @return bool Success status
     */
    public function reset(): bool
    {
        if (file_exists($this->progressFile)) {
            return unlink($this->progressFile);
        }
        
        return true;
    }

    /**
     * Mark the operation as completed
     * 
     * @return bool Success status
     */
    public function complete(): bool
    {
        $data = $this->getProgress();
        
        if (!$data) {
            return false;
        }
        
        $data['status'] = 'completed';
        $data['timestamp'] = time();
        
        return file_put_contents($this->progressFile, json_encode($data)) !== false;
    }
}