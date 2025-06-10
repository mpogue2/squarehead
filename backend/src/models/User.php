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
        'geocoded_at'
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
        // Get current user data to check if address changed
        $currentUser = $this->find($id);
        if (!$currentUser) {
            return false;
        }
        
        $addressChanged = false;
        if (isset($data['address'])) {
            $oldAddress = trim($currentUser['address'] ?? '');
            $newAddress = trim($data['address']);
            $addressChanged = $oldAddress !== $newAddress;
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
        
        return $this->update($id, $data);
    }
    
    /**
     * Geocode all users with addresses but no coordinates
     */
    public function geocodeAllMissingCoordinates(): array
    {
        // Find users with addresses but no coordinates
        $sql = "
            SELECT id, address 
            FROM users 
            WHERE address IS NOT NULL 
            AND address != '' 
            AND (latitude IS NULL OR longitude IS NULL)
        ";
        
        $stmt = $this->db->query($sql);
        $users = $stmt->fetchAll();
        
        if (empty($users)) {
            return ['geocoded' => 0, 'errors' => []];
        }
        
        try {
            $geocodingService = new \App\Services\GeocodingService();
            $results = $geocodingService->geocodeAddressBatch($users);
            
            $geocoded = 0;
            $errors = [];
            
            foreach ($results as $result) {
                if (isset($result['error'])) {
                    $errors[] = "User ID {$result['id']}: {$result['error']}";
                } else {
                    // Update user with coordinates
                    $this->update($result['id'], [
                        'latitude' => $result['lat'],
                        'longitude' => $result['lng'],
                        'geocoded_at' => date('Y-m-d H:i:s')
                    ]);
                    $geocoded++;
                }
            }
            
            return ['geocoded' => $geocoded, 'errors' => $errors];
            
        } catch (\Exception $e) {
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
