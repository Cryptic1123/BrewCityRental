# BCR Prototype - Node.js Server Setup

## Prerequisites
- Node.js 14+ installed
- MySQL Server running locally
- MySQL database named `brewcity` created

## Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Configure database connection (optional):**
   Edit `.env` file with your MySQL credentials:
   ```
DB_HOST=localhost
DB_USER=u423329802_root
DB_PASSWORD=BrewCityCapstone2026
DB_NAME=u423329802_brewcity
PORT=3306
   ```

3. **Ensure MySQL database exists:**
   ```sql
   CREATE DATABASE IF NOT EXISTS brewcity;
   ```

## Running the Server

**Start the server:**
```bash
npm start
```

**For development (with auto-reload):**
```bash
npm run dev
```

The server will run on `http://localhost:3000`

## API Endpoints

### Health Check
- `GET /api/health` - Test server connection

### Customers
- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get customer by ID
- `POST /api/customers` - Create new customer

### Movies
- `GET /api/movies` - Get all movies
- `GET /api/movies/:id` - Get movie by ID

### Rentals
- `GET /api/rentals` - Get all rentals
- `GET /api/rentals/customer/:customerId` - Get rentals for a customer
- `POST /api/rentals` - Create new rental

### Authentication
- `POST /api/employee/login` - Employee login
- `POST /api/customer/login` - Customer login

## Database Schema

The server expects the following tables in the `brewcity` database:
- `customers` (id, name, email, phone, password, ...)
- `movies` (id, title, genre, rating, description, ...)
- `rentals` (id, customer_id, dvd_id, rental_date, due_date, return_date)
- `employees` (id, username, password, role, ...)

## Troubleshooting

**Connection refused error:**
- Ensure MySQL Server is running
- Check database credentials in `.env` file
- Verify `brewcity` database exists

**Port already in use:**
- Change `PORT` in `.env` file or use environment variable:
  ```bash
  PORT=3001 npm start
  ```
