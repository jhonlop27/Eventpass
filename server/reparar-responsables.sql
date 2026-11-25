-- Completa únicamente las compras pendientes de asignación.
-- Usa el organizador actual del evento asociado a la localidad comprada.
UPDATE eventpass.compras AS c
SET usuario_responsable_id = e.organizador_id
FROM eventpass.tipos_entrada AS t
JOIN eventpass.eventos AS e ON e.id = t.evento_id
WHERE c.tipo_entrada_id = t.id
  AND c.usuario_responsable_id IS NULL;
