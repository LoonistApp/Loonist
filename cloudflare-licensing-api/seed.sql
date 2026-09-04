INSERT INTO Tenants (id, name) VALUES ('tenant-123', 'Acme Aerospace');

INSERT INTO Licenses (id, tenant_id, token, expires_at, status) 
VALUES ('license-123', 'tenant-123', 'test-activation-token-XYZ', '2030-01-01T00:00:00.000Z', 'PENDING');
