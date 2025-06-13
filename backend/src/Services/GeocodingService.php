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
            error_log("GeocodingService::geocodeAddress: Empty address provided");
            return null;
        }
        
        // Skip placeholder values
        if (trim($address) === 'Web Host' || strlen(trim($address)) < 10) {
            error_log("GeocodingService::geocodeAddress: Skipping invalid address: '{$address}'");
            return null;
        }
        
        error_log("GeocodingService::geocodeAddress: Geocoding address: '{$address}'");
        
        $url = $this->baseUrl . '?' . http_build_query([
            'address' => $address,
            'key' => $this->apiKey
        ]);
        
        // Initialize cURL with longer timeout
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30, // Increased timeout to 30 seconds
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => true, // Enable SSL verification for security
            CURLOPT_USERAGENT => 'Square Dance Club Management System/1.0'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($response === false || !empty($error)) {
            $errorMessage = "Geocoding API request failed: " . $error;
            error_log("GeocodingService::geocodeAddress: {$errorMessage}");
            throw new Exception($errorMessage);
        }
        
        if ($httpCode !== 200) {
            $errorMessage = "Geocoding API returned HTTP {$httpCode}";
            error_log("GeocodingService::geocodeAddress: {$errorMessage}");
            throw new Exception($errorMessage);
        }
        
        $data = json_decode($response, true);
        
        if (!$data) {
            error_log("GeocodingService::geocodeAddress: Invalid JSON response for address '{$address}'");
            return null;
        }
        
        if ($data['status'] !== 'OK' || empty($data['results'])) {
            // Log the status for debugging but don't throw exception
            error_log("GeocodingService::geocodeAddress: Geocoding failed for address '{$address}': " . ($data['status'] ?? 'Unknown error'));
            
            // Log error details if available
            if (isset($data['error_message'])) {
                error_log("GeocodingService::geocodeAddress: Error details: " . $data['error_message']);
            }
            
            return null;
        }
        
        $location = $data['results'][0]['geometry']['location'];
        
        error_log("GeocodingService::geocodeAddress: Successfully geocoded address '{$address}' to coordinates: " . 
                 json_encode(['lat' => $location['lat'], 'lng' => $location['lng']]));
        
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
        $count = count($addresses);
        
        error_log("GeocodingService::geocodeAddressBatch: Starting batch geocoding for {$count} addresses");
        
        foreach ($addresses as $index => $item) {
            $id = $item['id'];
            $address = $item['address'];
            $progress = ($index + 1) . " of {$count}";
            
            error_log("GeocodingService::geocodeAddressBatch: Processing address {$progress} - User ID {$id}: '{$address}'");
            
            // Skip empty or invalid addresses
            if (empty(trim($address)) || trim($address) === 'Web Host' || strlen(trim($address)) < 10) {
                error_log("GeocodingService::geocodeAddressBatch: Skipping invalid address for User ID {$id}: '{$address}'");
                $results[] = [
                    'id' => $id,
                    'error' => 'Invalid or incomplete address'
                ];
                continue;
            }
            
            try {
                $coords = $this->geocodeAddress($address);
                if ($coords) {
                    $results[] = [
                        'id' => $id,
                        'lat' => $coords['lat'],
                        'lng' => $coords['lng']
                    ];
                    error_log("GeocodingService::geocodeAddressBatch: Successfully geocoded User ID {$id}");
                } else {
                    $results[] = [
                        'id' => $id,
                        'error' => 'Could not geocode address'
                    ];
                    error_log("GeocodingService::geocodeAddressBatch: Failed to geocode User ID {$id} - no coordinates returned");
                }
            } catch (Exception $e) {
                $errorMessage = $e->getMessage();
                $results[] = [
                    'id' => $id,
                    'error' => $errorMessage
                ];
                error_log("GeocodingService::geocodeAddressBatch: Exception for User ID {$id}: {$errorMessage}");
            }
            
            // Adaptive rate limiting based on batch size
            if ($count > 10) {
                // For larger batches, use a larger delay to avoid rate limits
                usleep(200000); // 0.2 second delay
            } else {
                // For smaller batches, use a smaller delay
                usleep(100000); // 0.1 second delay
            }
        }
        
        error_log("GeocodingService::geocodeAddressBatch: Completed batch geocoding for {$count} addresses");
        
        // Count successes and failures
        $successCount = 0;
        $failureCount = 0;
        
        foreach ($results as $result) {
            if (isset($result['error'])) {
                $failureCount++;
            } else {
                $successCount++;
            }
        }
        
        error_log("GeocodingService::geocodeAddressBatch: Summary - {$successCount} addresses geocoded successfully, {$failureCount} failures");
        
        return $results;
    }
}
