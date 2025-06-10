<?php
declare(strict_types=1);

use App\Models\Settings;
use App\Services\GeocodingService;
use App\Middleware\AuthMiddleware;
use App\Helpers\ApiResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

// GET /api/settings - Get all settings (protected)
$app->get('/api/settings', function (Request $request, Response $response) {
    try {
        $settingsModel = new Settings();
        $settings = $settingsModel->getAllSettings();
        
        return ApiResponse::success($response, $settings, 'Settings retrieved successfully');
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to retrieve settings: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// GET /api/settings/{key} - Get specific setting (protected)
$app->get('/api/settings/{key}', function (Request $request, Response $response, array $args) {
    try {
        $key = $args['key'];
        $settingsModel = new Settings();
        $value = $settingsModel->get($key);
        
        if ($value === null) {
            return ApiResponse::notFound($response, "Setting '{$key}' not found");
        }
        
        $settingData = [
            'key' => $key,
            'value' => $value
        ];
        
        return ApiResponse::success($response, $settingData);
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to retrieve setting: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// PUT /api/settings - Update settings (admin only)
$app->put('/api/settings', function (Request $request, Response $response) {
    try {
        $isAdmin = $request->getAttribute('is_admin');
        
        if (!$isAdmin) {
            return ApiResponse::error($response, 'Admin access required to update settings', 403);
        }
        
        $data = json_decode($request->getBody()->getContents(), true);
        
        if (empty($data) || !is_array($data)) {
            return ApiResponse::validationError($response, [], 'Valid settings data is required');
        }
        
        $settingsModel = new Settings();
        $updatedSettings = [];
        $errors = [];
        
        // Define allowed settings with validation rules
        $allowedSettings = [
            'club_name' => ['type' => 'string', 'required' => false, 'max_length' => 100],
            'club_subtitle' => ['type' => 'string', 'required' => false, 'max_length' => 200],
            'club_address' => ['type' => 'string', 'required' => false, 'max_length' => 255],
            'club_lat' => ['type' => 'string', 'required' => false],
            'club_lng' => ['type' => 'string', 'required' => false],
            'club_color' => ['type' => 'string', 'required' => false, 'pattern' => '/^#[0-9A-Fa-f]{6}$/'],
            'club_day_of_week' => ['type' => 'string', 'required' => false, 'enum' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']],
            'reminder_days' => ['type' => 'string', 'required' => false, 'pattern' => '/^[0-9,\s]*$/'],
            'club_logo_url' => ['type' => 'string', 'required' => false, 'max_length' => 500],
            'google_api_key' => ['type' => 'string', 'required' => false, 'max_length' => 100],
            'email_from_name' => ['type' => 'string', 'required' => false, 'max_length' => 100],
            'email_from_address' => ['type' => 'string', 'required' => false, 'max_length' => 255],
            'email_template_subject' => ['type' => 'string', 'required' => false, 'max_length' => 200],
            'email_template_body' => ['type' => 'string', 'required' => false, 'max_length' => 5000],
            'smtp_host' => ['type' => 'string', 'required' => false, 'max_length' => 255],
            'smtp_port' => ['type' => 'string', 'required' => false, 'pattern' => '/^[1-9][0-9]{0,4}$/'],
            'smtp_username' => ['type' => 'string', 'required' => false, 'max_length' => 255],
            'smtp_password' => ['type' => 'string', 'required' => false, 'max_length' => 255],
            'system_timezone' => ['type' => 'string', 'required' => false, 'max_length' => 50],
            'max_upload_size' => ['type' => 'string', 'required' => false, 'pattern' => '/^[1-9][0-9]?$|^100$/'],
            'backup_enabled' => ['type' => 'string', 'required' => false],
            'backup_frequency' => ['type' => 'string', 'required' => false, 'enum' => ['daily', 'weekly', 'monthly']]
        ];
        
        // Validate and process each setting
        foreach ($data as $key => $value) {
            if (!array_key_exists($key, $allowedSettings)) {
                $errors[$key] = "Setting '{$key}' is not allowed";
                continue;
            }
            
            $rules = $allowedSettings[$key];
            
            // Convert value to string for storage
            $stringValue = is_string($value) ? $value : json_encode($value);
            
            // Validate based on rules
            if (!empty($rules['max_length']) && strlen($stringValue) > $rules['max_length']) {
                $errors[$key] = "Value exceeds maximum length of {$rules['max_length']} characters";
                continue;
            }
            
            if (!empty($rules['pattern']) && !preg_match($rules['pattern'], $stringValue)) {
                $errors[$key] = "Value does not match required format";
                continue;
            }
            
            if (!empty($rules['enum']) && !in_array($stringValue, $rules['enum'])) {
                $errors[$key] = "Value must be one of: " . implode(', ', $rules['enum']);
                continue;
            }
            
            // Special validation for club_color
            if ($key === 'club_color' && !empty($stringValue)) {
                if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $stringValue)) {
                    $errors[$key] = "Club color must be a valid hex color (e.g., #EA3323)";
                    continue;
                }
            }
            
            // Special validation for reminder_days
            if ($key === 'reminder_days' && !empty($stringValue)) {
                $cleanValue = preg_replace('/\s+/', '', $stringValue);
                if (!preg_match('/^[0-9]+(,[0-9]+)*$/', $cleanValue)) {
                    $errors[$key] = "Reminder days must be comma-separated numbers (e.g., 14,7,3,1)";
                    continue;
                }
                $stringValue = $cleanValue; // Use cleaned value
            }
            
            // Special validation for SMTP port
            if ($key === 'smtp_port' && !empty($stringValue)) {
                $port = intval($stringValue);
                if ($port < 1 || $port > 65535) {
                    $errors[$key] = "SMTP port must be between 1 and 65535";
                    continue;
                }
            }
            
            // Update the setting
            $success = $settingsModel->set($key, $stringValue, $rules['type']);
            if ($success) {
                $updatedSettings[$key] = $stringValue;
            } else {
                $errors[$key] = "Failed to update setting";
            }
        }
        
        // Handle geocoding for club_address changes
        if (isset($updatedSettings['club_address']) && !empty($updatedSettings['club_address'])) {
            $googleApiKey = $settingsModel->get('google_api_key');
            if (!empty($googleApiKey)) {
                $geocodingService = new GeocodingService($googleApiKey);
                $coordinates = $geocodingService->geocodeAddress($updatedSettings['club_address']);
                
                if ($coordinates) {
                    // Save the geocoded coordinates
                    $settingsModel->set('club_lat', (string) $coordinates['lat'], 'string');
                    $settingsModel->set('club_lng', (string) $coordinates['lng'], 'string');
                    $updatedSettings['club_lat'] = (string) $coordinates['lat'];
                    $updatedSettings['club_lng'] = (string) $coordinates['lng'];
                } else {
                    // Clear coordinates if geocoding failed
                    $settingsModel->set('club_lat', '', 'string');
                    $settingsModel->set('club_lng', '', 'string');
                    $updatedSettings['club_lat'] = '';
                    $updatedSettings['club_lng'] = '';
                }
            }
        }
        
        // Return results
        if (!empty($errors)) {
            return ApiResponse::validationError($response, $errors, 'Some settings could not be updated');
        }
        
        if (empty($updatedSettings)) {
            return ApiResponse::validationError($response, [], 'No valid settings provided');
        }
        
        // Get all current settings to return
        $allSettings = $settingsModel->getAllSettings();
        
        return ApiResponse::success($response, $allSettings, 'Settings updated successfully');
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to update settings: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// PUT /api/settings/{key} - Update specific setting (admin only)
$app->put('/api/settings/{key}', function (Request $request, Response $response, array $args) {
    try {
        $isAdmin = $request->getAttribute('is_admin');
        
        if (!$isAdmin) {
            return ApiResponse::error($response, 'Admin access required to update settings', 403);
        }
        
        $key = $args['key'];
        $data = json_decode($request->getBody()->getContents(), true);
        
        if (!isset($data['value'])) {
            return ApiResponse::validationError($response, ['value' => 'Value is required'], 'Setting value is required');
        }
        
        $value = is_string($data['value']) ? $data['value'] : json_encode($data['value']);
        
        $settingsModel = new Settings();
        $success = $settingsModel->set($key, $value, 'string');
        
        if (!$success) {
            return ApiResponse::error($response, 'Failed to update setting', 500);
        }
        
        $settingData = [
            'key' => $key,
            'value' => $value
        ];
        
        return ApiResponse::success($response, $settingData, 'Setting updated successfully');
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to update setting: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());
