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
        $stmt = $this->db->prepare($sql);
        $stmt->execute($filtered);
        
        $id = $this->db->lastInsertId();
        return $this->find((int)$id);
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
        return array_intersect_key($data, array_flip($this->fillable));
    }
}
