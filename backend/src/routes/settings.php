<?php
declare(strict_types=1);

use App\Models\Settings;
use App\Services\GeocodingService;
use App\Middleware\AuthMiddleware;
use App\Helpers\ApiResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver;

// GET /api/settings - Get all settings (protected)
$app->get('/api/settings', function (Request $request, Response $response) {
    try {
        $settingsModel = new Settings();
        $settings = $settingsModel->getAllSettings();
        
        // Log the settings being returned for debugging
        error_log("Retrieved settings: " . json_encode(array_keys($settings)));
        
        // Check if we have a logo in the database, add it to the response
        if (isset($settings['club_logo_data']) && !empty($settings['club_logo_data'])) {
            error_log("Logo data found in settings, length: " . strlen($settings['club_logo_data']));
            // Base64 data is already in the settings
            // No need to modify it
        } else {
            error_log("No logo data found in settings");
        }
        
        return ApiResponse::success($response, $settings, 'Settings retrieved successfully');
    } catch (Exception $e) {
        error_log("Error retrieving settings: " . $e->getMessage());
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
            'club_logo_data' => ['type' => 'string', 'required' => false], // Base64 encoded logo data
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
        
        // Debug: Log request data
        error_log("Settings update data: " . json_encode(array_keys($data)));
        
        // Validate and process each setting
        foreach ($data as $key => $value) {
            if (!array_key_exists($key, $allowedSettings)) {
                $errors[$key] = "Setting '{$key}' is not allowed";
                error_log("Validation failed for key '{$key}': not in allowed settings list");
                continue;
            }
            
            $rules = $allowedSettings[$key];
            
            // Skip validation for club_logo_data since it's a large base64 string
            if ($key === 'club_logo_data') {
                // Debug the type of club_logo_data
                error_log("club_logo_data type: " . gettype($value));
                
                if (is_string($value)) {
                    // It's valid, continue to the next setting
                    $stringValue = $value;
                    error_log("club_logo_data is a string of length: " . strlen($value));
                } else if (is_null($value)) {
                    // Null is valid (means no logo)
                    $stringValue = '';
                    error_log("club_logo_data is null, setting to empty string");
                } else if (is_array($value) || is_object($value)) {
                    $errors[$key] = "Logo data must be a string, not an array/object";
                    error_log("Validation failed for club_logo_data: is array/object");
                    continue;
                } else {
                    $errors[$key] = "Logo data must be a string (is " . gettype($value) . ")";
                    error_log("Validation failed for club_logo_data: not a string but " . gettype($value));
                    continue;
                }
            } else {
                // For other fields, convert value to string for storage
                $stringValue = is_string($value) ? $value : json_encode($value);
                
                // Validate based on rules
                if (!empty($rules['max_length']) && strlen($stringValue) > $rules['max_length']) {
                    $errors[$key] = "Value exceeds maximum length of {$rules['max_length']} characters";
                    error_log("Validation failed for key '{$key}': exceeds max length {$rules['max_length']}");
                    continue;
                }
                
                if (!empty($rules['pattern']) && !preg_match($rules['pattern'], $stringValue)) {
                    $errors[$key] = "Value does not match required format";
                    error_log("Validation failed for key '{$key}': does not match pattern {$rules['pattern']}");
                    continue;
                }
                
                if (!empty($rules['enum']) && !in_array($stringValue, $rules['enum'])) {
                    $errors[$key] = "Value must be one of: " . implode(', ', $rules['enum']);
                    error_log("Validation failed for key '{$key}': not in enum list");
                    continue;
                }
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

// POST /api/settings/upload-logo - Upload and process club logo (admin only)
$app->post('/api/settings/upload-logo', function (Request $request, Response $response) {
    try {
        $isAdmin = $request->getAttribute('is_admin');
        
        if (!$isAdmin) {
            error_log("Logo upload rejected: Not an admin");
            return ApiResponse::error($response, 'Admin access required to upload logo', 403);
        }
        
        error_log("Processing logo upload request from admin");
        
        // Get uploaded file
        $uploadedFiles = $request->getUploadedFiles();
        
        if (empty($uploadedFiles['logo'])) {
            error_log("Logo upload failed: No logo file in request");
            return ApiResponse::validationError($response, ['logo' => 'Logo file is required'], 'Logo file is required');
        }
        
        $uploadedFile = $uploadedFiles['logo'];
        
        if ($uploadedFile->getError() !== UPLOAD_ERR_OK) {
            error_log("Logo upload failed with error code: " . $uploadedFile->getError());
            return ApiResponse::validationError($response, ['logo' => 'Upload failed'], 'Upload failed with error code: ' . $uploadedFile->getError());
        }
        
        // Check file type
        $clientFilename = $uploadedFile->getClientFilename();
        error_log("Logo filename: " . $clientFilename);
        $extension = strtolower(pathinfo($clientFilename, PATHINFO_EXTENSION));
        
        if (!in_array($extension, ['jpg', 'jpeg', 'png'])) {
            error_log("Logo upload failed: Invalid file type: " . $extension);
            return ApiResponse::validationError($response, ['logo' => 'Invalid file type'], 'Only JPG and PNG files are allowed');
        }
        
        // Create temporary file
        $tmpFile = tempnam(sys_get_temp_dir(), 'logo_');
        $uploadedFile->moveTo($tmpFile);
        error_log("Logo saved to temporary file: " . $tmpFile);
        
        // Initialize ImageManager with GD driver
        $manager = new ImageManager(new Driver());
        
        try {
            // The newer version of Intervention Image has a different API
            // Load image directly through the manager
            error_log("Loading image from temporary file: " . $tmpFile);
            $img = $manager->read($tmpFile);
            error_log("Image loaded successfully");
            
            // Get dimensions for logging
            $imgWidth = $img->width();
            $imgHeight = $img->height();
            error_log("Image original dimensions: " . $imgWidth . "x" . $imgHeight);
            
            // Resize to 128x128
            $img = $img->cover(128, 128);
            error_log("Image resized to 128x128");
            
            // Encode as JPEG with 90% quality and get as base64
            $encodedImage = base64_encode($img->toJpeg(90)->toString());
            error_log("Image encoded as base64, length: " . strlen($encodedImage));
            
            // Store in database
            $settingsModel = new Settings();
            $settingsModel->set('club_logo_data', $encodedImage, 'string');
            error_log("Logo saved to database");
            
            // Clean up temporary file
            unlink($tmpFile);
            
            return ApiResponse::success($response, ['logo_data' => $encodedImage], 'Logo uploaded and processed successfully');
            
        } catch (Exception $e) {
            // Clean up temporary file on error
            if (file_exists($tmpFile)) {
                unlink($tmpFile);
            }
            error_log("Error processing logo image: " . $e->getMessage());
            throw $e;
        }
        
    } catch (Exception $e) {
        error_log("Logo upload failed with exception: " . $e->getMessage());
        return ApiResponse::error($response, 'Failed to upload logo: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());
