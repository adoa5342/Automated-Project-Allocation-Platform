## Quick Start to Simulate Allocation with Backend API and Database

### NOTE: Assumed that Docker is installed, run the following command at root level
docker-compose up --build

### To import CSV files, use the following command
curl -X POST http://localhost:3000/api/v1/import -F "file=@FILENAME.zip"

#### NOTE
### To create sample admin account and student account, run the following command in backend/
npx tsx src/seed.ts

### NOTE
Replace FILENAME in the above command to the actual path to the .zip file containing the CSV files.

### To run the allocation, use the following command
- curl -X POST http://localhost:3000/api/v1/allocate

### To view the allocation results, use the following command
- curl http://localhost:3000/api/v1/results

### API Documentation (OpenAPI)
- File: `backend/openapi.yaml`
- Served at runtime: `http://localhost:3000/api-docs.yaml`

### To inspect the data in the DB, ensure the container for the database is still running and run the following command
- cd backend
- npx prisma studio

### To clear the data in the DB, ensure the container for the database is still running and run the following command
- cd backend && npx prisma migrate reset

### To close Docker
- docker-compose down