<?php
declare(strict_types=1);

namespace App\Models;

use PDO;
use App\Database;

abstract class BaseModel
{
    protected PDO $db;
    protected string $table;
    protected array $fillable = [];
    
    public function __construct()
    {
        $this->db = Database::getConnection();
    }
    
    public function find(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE id = ?");
        $stmt->execute([$id]);
        $result = $stmt->fetch();
        return $result ?: null;
    }
    
    public function all(): array
    {
        $stmt = $this->db->query("SELECT * FROM {$this->table} ORDER BY id");
        return $stmt->fetchAll();
    }
    
    public function create(array $data): array
    {
        $filtered = $this->filterFillable($data);
        $columns = implode(', ', array_keys($filtered));
        $placeholders = ':' . implode(', :', array_keys($filtered));
        
        $sql = "INSERT INTO {$this->table} ({$columns}) VALUES ({$placeholders})";
        
        // Debug the SQL and data for troubleshooting
        if (isset($data['first_name']) && isset($data['last_name'])) {
            $userIdentifier = "{$data['first_name']} {$data['last_name']}";
            error_log("BaseModel::create - For {$userIdentifier}, SQL: {$sql}");
            error_log("BaseModel::create - For {$userIdentifier}, Data: " . json_encode($filtered));
        }
        
        try {
            $stmt = $this->db->prepare($sql);
            $result = $stmt->execute($filtered);
            
            if (!$result) {
                $errorInfo = $stmt->errorInfo();
                error_log("BaseModel::create - SQL Error: " . json_encode($errorInfo));
                throw new \PDOException("Database error: " . ($errorInfo[2] ?? 'Unknown error'), (int)($errorInfo[1] ?? 0));
            }
            
            $id = $this->db->lastInsertId();
            return $this->find((int)$id);
        } catch (\PDOException $e) {
            error_log("BaseModel::create - Exception: " . $e->getMessage());
            throw $e;
        }
    }
    
    public function update(int $id, array $data): ?array
    {
        $filtered = $this->filterFillable($data);
        $setParts = [];
        
        foreach (array_keys($filtered) as $column) {
            $setParts[] = "{$column} = :{$column}";
        }
        
        $sql = "UPDATE {$this->table} SET " . implode(', ', $setParts) . " WHERE id = :id";
        $filtered['id'] = $id;
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($filtered);
        return $this->find($id);
    }
    
    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare("DELETE FROM {$this->table} WHERE id = ?");
        return $stmt->execute([$id]);
    }
    
    protected function filterFillable(array $data): array
    {
        $filtered = array_intersect_key($data, array_flip($this->fillable));
        
        // Debug log to track filtered data
        if (isset($data['first_name']) && isset($data['last_name'])) {
            $userIdentifier = "{$data['first_name']} {$data['last_name']}";
            error_log("BaseModel::filterFillable - For {$userIdentifier}, filtered data keys: " . implode(', ', array_keys($filtered)));
            
            // Check if notes field is being preserved if present
            if (isset($data['notes']) && !isset($filtered['notes'])) {
                error_log("WARNING: 'notes' field was in original data but filtered out for {$userIdentifier}");
            }
        }
        
        return $filtered;
    }
    
    /**
     * Get the type of database being used
     */
    protected function getDatabaseType(): string
    {
        // Try to detect the database type from PDO
        $driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
        
        // Check for SQLite
        if ($driver === 'sqlite') {
            return 'sqlite';
        }
        
        // Check for MySQL/MariaDB
        if ($driver === 'mysql') {
            return 'mysql';
        }
        
        // Default to MySQL/MariaDB syntax
        return 'mysql';
    }
    
    /**
     * Get the appropriate date function for the current database
     */
    protected function getCurrentDateFunction(): string
    {
        $dbType = $this->getDatabaseType();
        return $dbType === 'sqlite' ? "datetime('now')" : "NOW()";
    }
}
