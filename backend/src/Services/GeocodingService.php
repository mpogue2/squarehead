<?php
declare(strict_types=1);

namespace App\Services;

use Exception;

class GeocodingService
{
    private string $apiKey;
    private string $baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    
    public function __construct()
    {
        // Get API key from settings
        $db = \App\Database::getConnection();
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'google_api_key'");
        $stmt->execute();
        $result = $stmt->fetch();
        
        if (!$result || empty($result['setting_value'])) {
            throw new Exception('Google Maps API key not found in settings');
        }
        
        $this->apiKey = $result['setting_value'];
    }
    
    /**
     * Geocode an address to latitude/longitude coordinates
     * 
     * @param string $address The address to geocode
     * @return array|null Returns ['lat' => float, 'lng' => float] or null if geocoding fails
     * @throws Exception If API request fails
     */
    public function geocodeAddress(string $address): ?array
    {
        if (empty(trim($address))) {
            return null;
        }
        
        $url = $this->baseUrl . '?' . http_build_query([
            'address' => $address,
            'key' => $this->apiKey
        ]);
        
        // Initialize cURL
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false, // For development
            CURLOPT_USERAGENT => 'Square Dance Club Management System/1.0'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($response === false || !empty($error)) {
            throw new Exception("Geocoding API request failed: " . $error);
        }
        
        if ($httpCode !== 200) {
            throw new Exception("Geocoding API returned HTTP {$httpCode}");
        }
        
        $data = json_decode($response, true);
        
        if (!$data || $data['status'] !== 'OK' || empty($data['results'])) {
            // Log the status for debugging but don't throw exception
            error_log("Geocoding failed for address '{$address}': " . ($data['status'] ?? 'Unknown error'));
            return null;
        }
        
        $location = $data['results'][0]['geometry']['location'];
        
        return [
            'lat' => (float) $location['lat'],
            'lng' => (float) $location['lng']
        ];
    }
    
    /**
     * Check if we should re-geocode based on cache age
     * 
     * @param string|null $geocodedAt ISO timestamp of last geocoding
     * @param int $maxAgeHours Maximum age in hours before re-geocoding (default: 24 hours)
     * @return bool True if should re-geocode
     */
    public function shouldReGeocode(?string $geocodedAt, int $maxAgeHours = 24): bool
    {
        if (empty($geocodedAt)) {
            return true;
        }
        
        $lastGeocoded = strtotime($geocodedAt);
        if ($lastGeocoded === false) {
            return true;
        }
        
        $ageSeconds = time() - $lastGeocoded;
        $maxAgeSeconds = $maxAgeHours * 3600;
        
        return $ageSeconds > $maxAgeSeconds;
    }
    
    /**
     * Geocode multiple addresses in batch
     * 
     * @param array $addresses Array of ['id' => int, 'address' => string]
     * @return array Array of ['id' => int, 'lat' => float, 'lng' => float] or ['id' => int, 'error' => string]
     */
    public function geocodeAddressBatch(array $addresses): array
    {
        $results = [];
        
        foreach ($addresses as $item) {
            $id = $item['id'];
            $address = $item['address'];
            
            try {
                $coords = $this->geocodeAddress($address);
                if ($coords) {
                    $results[] = [
                        'id' => $id,
                        'lat' => $coords['lat'],
                        'lng' => $coords['lng']
                    ];
                } else {
                    $results[] = [
                        'id' => $id,
                        'error' => 'Could not geocode address'
                    ];
                }
            } catch (Exception $e) {
                $results[] = [
                    'id' => $id,
                    'error' => $e->getMessage()
                ];
            }
            
            // Small delay to avoid hitting API rate limits
            usleep(100000); // 0.1 second delay
        }
        
        return $results;
    }
}
