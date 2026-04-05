# Finance Data Processing and Access Control Backend

This is the backend implementation for the Finance Dashboard system designed for the Zorvyn internship screening assignment.

## Tech Stack
*   **Engine:** Node.js
*   **Framework:** Express.js
*   **Database:** MongoDB
*   **ODM:** Mongoose
*   **Authentication:** JSON Web Tokens (JWT)
*   **Validation:** express-validator
*   **Security:** bcryptjs (for password hashing)

## Features & Implementation Details

### 1. User and Role Management
*   **Feature:** Role-based access control with `Viewer`, `Analyst`, and `Admin` roles.
*   **Architecture:** Uses JWT for stateless authentication. Passwords are encrypted using bcrypt. User status (Active/Inactive) is supported to revoke access globally.
*   **Endpoints:**
    *   `POST /api/v1/auth/register` - Create a new user account (Can specify a role, default is Viewer)
    *   `POST /api/v1/auth/login` - Exchange email & password for a JWT token.

### 2. Financial Records Management
*   **Feature:** Complete CRUD operations for financial records. Models include essential fields: `amount`, `type` (income/expense), `category`, `date`, `notes`, and `createdBy`.
*   **Architecture:** Implements advanced query features natively (e.g. `?limit=10&page=2&sort=-date&type=income`).
*   **Endpoints:**
    *   `GET /api/v1/records` - List records (with filters & pagination)
    *   `GET /api/v1/records/:id` - Get single record
    *   `POST /api/v1/records` - Create a new record
    *   `PATCH /api/v1/records/:id` - Update an existing record
    *   `DELETE /api/v1/records/:id` - Remove a record

### 3. Dashboard Summary APIs
*   **Feature:** High-level aggregated data for frontend dashboards.
*   **Architecture:** Uses MongoDB Aggregation Framework for rapid, database-level aggregation of net balance, totals, and category breakdowns.
*   **Endpoints:**
    *   `GET /api/v1/summary` - Retrieves total income, total expense, net balance, categorized limits, and the most recent 5 activities.

### 4. Access Control Logic
*   **Implementation:** Express middlewares handle JWT validation (`protect`) and role-based restrictions (`restrictTo`).
    *   **Admin:** Can create, read, update, and delete records. Appointed full access.
    *   **Analyst:** Can view all records and financial summaries. Cannot modify or delete records.
    *   **Viewer:** Can only view the highest-level dashboard summary data. Cannot access granular record endpoints.

### 5. Validation and Error Handling
*   **Validation:** Uses `express-validator` to protect the `/api/v1/records` POST endpoint preventing malformed inserts.
*   **Error Handling:** Implemented a global Express error handler `errorHandler.js` handling async errors gracefully, abstracting complex MongoDB error states (like CastError, DuplicateKey) into readable 400 requests.

## Installation & Setup

1.  **Dependencies:**
    ```bash
    npm install
    ```
2.  **Environment Variables:**
    Copy the `.env.example` to `.env` and assign your MongoDB connection string to `MONGODB_URI`.
    ```bash
    cp .env.example .env
    ```
3.  **Run Application:**
    ```bash
    npm start # Or node server.js
    ```
   *By default, the server runs on Port 5000.*

## Assumptions
*   Authentication is strictly JWT based.
*   Registration currently allows assigning your own level for ease of demonstration, whereas for production this would strictly be an Admin-only path.
*   Summary data does not enforce strict multi-tenancy limits for demonstration purposes (you might want Admins to only see organizational data, whilst basic users only see their own - here, all validated users share a pool of organizational documents).
