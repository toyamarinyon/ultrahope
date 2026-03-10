-- Custom SQL migration file, put your code below! --
UPDATE command_execution SET installation_id = 'legacy' WHERE installation_id IS NULL;
