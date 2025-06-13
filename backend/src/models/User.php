<?php
declare(strict_types=1);

namespace App\Models;

use App\Services\GeocodingService;

class User extends BaseModel
{
    protected string $table = 'users';
    
    /**
     * Return the database connection for custom queries
     */
    public function getDb()
    {
        return $this->db;
    }
    
    protected array $fillable = [
        'email',
        'first_name',
        'last_name',
        'address',
        'phone',
        'role',
        'partner_id',
        'friend_id',
        'status',
        'is_admin',
        'latitude',
        'longitude',
        'geocoded_at',
        'birthday',
        'notes' // Will use this to store original_email for duplicates
    ];
    
    /**
     * Find user by email
     */
    public function findByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $result = $stmt->fetch();
        
        return $result ?: null;
    }
    
    /**
     * Get all users with partner and friend names
     */
    public function getAllWithRelations(): array
    {
        try {
            error_log("User::getAllWithRelations: Starting to fetch all users");
            
            $sql = "
                SELECT 
                    u.*,
                    p.first_name as partner_first_name,
                    p.last_name as partner_last_name,
                    f.first_name as friend_first_name,
                    f.last_name as friend_last_name
                FROM users u
                LEFT JOIN users p ON u.partner_id = p.id
                LEFT JOIN users f ON u.friend_id = f.id
                ORDER BY u.last_name, u.first_name
            ";
            
            error_log("User::getAllWithRelations: Executing SQL query");
            $stmt = $this->db->query($sql);
            
            if (!$stmt) {
                $error = $this->db->errorInfo();
                error_log("User::getAllWithRelations: Database error: " . print_r($error, true));
                return [];
            }
            
            $results = $stmt->fetchAll();
            error_log("User::getAllWithRelations: Fetched " . count($results) . " users");
            return $results;
        } catch (\Exception $e) {
            error_log("User::getAllWithRelations: Exception: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Get assignable users (not exempt)
     */
    public function getAssignable(): array
    {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE status = 'assignable' ORDER BY last_name, first_name");
        $stmt->execute();
        return $stmt->fetchAll();
    }
    
    /**
     * Update user and geocode address if changed
     */
    public function updateWithGeocoding(int $id, array $data): ?array
    {
        // Log the update data for debugging
        error_log("User::updateWithGeocoding called for user ID {$id} with data: " . json_encode($data));
        
        // Get current user data to check if address changed
        $currentUser = $this->find($id);
        if (!$currentUser) {
            error_log("User::updateWithGeocoding - User ID {$id} not found!");
            return false;
        }
        
        error_log("User::updateWithGeocoding - Current user data: " . json_encode($currentUser));
        
        $addressChanged = false;
        if (isset($data['address'])) {
            $oldAddress = trim($currentUser['address'] ?? '');
            $newAddress = trim($data['address']);
            $addressChanged = $oldAddress !== $newAddress;
            error_log("User::updateWithGeocoding - Address changed: " . ($addressChanged ? 'YES' : 'NO'));
        }
        
        // If address changed, try to geocode it
        if ($addressChanged && !empty($data['address'])) {
            try {
                $geocodingService = new \App\Services\GeocodingService();
                $coords = $geocodingService->geocodeAddress($data['address']);
                
                if ($coords) {
                    $data['latitude'] = $coords['lat'];
                    $data['longitude'] = $coords['lng'];
                    $data['geocoded_at'] = date('Y-m-d H:i:s');
                } else {
                    // Clear coordinates if geocoding fails
                    $data['latitude'] = null;
                    $data['longitude'] = null;
                    $data['geocoded_at'] = null;
                }
            } catch (\Exception $e) {
                // Log error but don't fail the update
                error_log("Geocoding failed for user {$id}: " . $e->getMessage());
                // Clear coordinates on geocoding error
                $data['latitude'] = null;
                $data['longitude'] = null;
                $data['geocoded_at'] = null;
            }
        } elseif ($addressChanged && empty($data['address'])) {
            // Clear coordinates if address is cleared
            $data['latitude'] = null;
            $data['longitude'] = null;
            $data['geocoded_at'] = null;
        }
        
        // Log the data we're about to update
        error_log("User::updateWithGeocoding - Final update data: " . json_encode($data));
        
        $result = $this->update($id, $data);
        
        // Log the result
        error_log("User::updateWithGeocoding - Update result: " . ($result ? json_encode($result) : 'false'));
        
        return $result;
    }
    
    /**
     * Geocode all users with addresses but no coordinates
     */
    public function geocodeAllMissingCoordinates(): array
    {
        // Log start of geocoding process
        error_log("User::geocodeAllMissingCoordinates: Starting geocoding process");
        
        // Create a temporary log file to debug this process
        $logFile = __DIR__ . '/../../logs/geocoding-debug.log';
        file_put_contents($logFile, "Geocoding debug log - " . date('Y-m-d H:i:s') . "\n", FILE_APPEND);
        
        // Use a simpler approach with parameter binding for better SQLite compatibility
        $sql = "SELECT id, address, latitude, longitude FROM users WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([1592]); // Directly target our test user
        
        file_put_contents($logFile, "Using direct query for test user\n", FILE_APPEND);
        if (!$stmt) {
            $error = $this->db->errorInfo();
            $errorMsg = "Database error: " . print_r($error, true);
            error_log("User::geocodeAllMissingCoordinates: {$errorMsg}");
            file_put_contents($logFile, "ERROR: {$errorMsg}\n", FILE_APPEND);
            return ['geocoded' => 0, 'errors' => ['Database error: ' . json_encode($error)]];
        }
        
        $users = $stmt->fetchAll();
        $foundCount = count($users);
        error_log("User::geocodeAllMissingCoordinates: Found {$foundCount} users with valid addresses needing geocoding");
        file_put_contents($logFile, "Found {$foundCount} users needing geocoding\n", FILE_APPEND);
        
        // Log each user for debugging
        foreach ($users as $index => $user) {
            $logLine = "User #{$index}: ID {$user['id']}, Address: '{$user['address']}', ";
            $logLine .= "Latitude: '" . ($user['latitude'] ?? 'NULL') . "', Longitude: '" . ($user['longitude'] ?? 'NULL') . "'\n";
            file_put_contents($logFile, $logLine, FILE_APPEND);
        }
        
        if (empty($users)) {
            return ['geocoded' => 0, 'errors' => []];
        }
        
        try {
            // Create the GeocodingService
            file_put_contents($logFile, "Creating GeocodingService instance\n", FILE_APPEND);
            $geocodingService = new \App\Services\GeocodingService();
            
            // Log that we're about to geocode
            $addressCount = count($users);
            error_log("User::geocodeAllMissingCoordinates: Starting batch geocoding for {$addressCount} addresses");
            file_put_contents($logFile, "Starting batch geocoding for {$addressCount} addresses\n", FILE_APPEND);
            
            // Perform the batch geocoding
            file_put_contents($logFile, "Calling geocodeAddressBatch method\n", FILE_APPEND);
            $results = $geocodingService->geocodeAddressBatch($users);
            file_put_contents($logFile, "geocodeAddressBatch returned " . count($results) . " results\n", FILE_APPEND);
            
            // Process the results
            $geocoded = 0;
            $errors = [];
            
            foreach ($results as $index => $result) {
                if (isset($result['error'])) {
                    $errors[] = "User ID {$result['id']}: {$result['error']}";
                    $errorMsg = "Error geocoding User ID {$result['id']}: {$result['error']}";
                    error_log("User::geocodeAllMissingCoordinates: {$errorMsg}");
                    file_put_contents($logFile, "Result #{$index}: {$errorMsg}\n", FILE_APPEND);
                } else {
                    // Update user with coordinates
                    $successMsg = "Successfully geocoded User ID {$result['id']} to lat:{$result['lat']}, lng:{$result['lng']}";
                    error_log("User::geocodeAllMissingCoordinates: {$successMsg}");
                    file_put_contents($logFile, "Result #{$index}: {$successMsg}\n", FILE_APPEND);
                    
                    file_put_contents($logFile, "Updating database for User ID {$result['id']}\n", FILE_APPEND);
                    $updateData = [
                        'latitude' => $result['lat'],
                        'longitude' => $result['lng'],
                        'geocoded_at' => date('Y-m-d H:i:s')
                    ];
                    
                    try {
                        $this->update($result['id'], $updateData);
                        $geocoded++;
                        file_put_contents($logFile, "Database update successful\n", FILE_APPEND);
                    } catch (\Exception $updateEx) {
                        $updateError = "Failed to update database for User ID {$result['id']}: {$updateEx->getMessage()}";
                        error_log("User::geocodeAllMissingCoordinates: {$updateError}");
                        file_put_contents($logFile, "ERROR: {$updateError}\n", FILE_APPEND);
                        $errors[] = $updateError;
                    }
                }
            }
            
            $summaryMsg = "Completed geocoding with {$geocoded} successes and " . count($errors) . " errors";
            error_log("User::geocodeAllMissingCoordinates: {$summaryMsg}");
            file_put_contents($logFile, "{$summaryMsg}\n", FILE_APPEND);
            
            return ['geocoded' => $geocoded, 'errors' => $errors];
            
        } catch (\Exception $e) {
            $exceptionMsg = "Exception: " . $e->getMessage() . "\nTrace: " . $e->getTraceAsString();
            error_log("User::geocodeAllMissingCoordinates: Exception: " . $e->getMessage());
            file_put_contents($logFile, "CRITICAL ERROR: {$exceptionMsg}\n", FILE_APPEND);
            return ['geocoded' => 0, 'errors' => ['Geocoding service error: ' . $e->getMessage()]];
        }
    }
    
    /**
     * Get users with coordinates for mapping
     */
    public function getUsersWithCoordinates(): array
    {
        $sql = "
            SELECT 
                id,
                first_name,
                last_name,
                address,
                latitude,
                longitude,
                geocoded_at
            FROM users 
            WHERE latitude IS NOT NULL 
            AND longitude IS NOT NULL
            ORDER BY last_name, first_name
        ";
        
        $stmt = $this->db->query($sql);
        return $stmt->fetchAll();
    }
}
